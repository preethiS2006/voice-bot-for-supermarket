document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM Elements ----
    const micBtn = document.getElementById('mic-btn');
    const micWrapper = document.querySelector('.mic-wrapper');
    const statusText = document.getElementById('status-text');
    const statusBadge = document.getElementById('status-badge');
    const transcriptContainer = document.getElementById('transcript-container');
    const languageRadios = document.querySelectorAll('input[name="language"]');
    const initTime = document.getElementById('init-time');
    const canvas = document.getElementById('audio-visualizer');
    const canvasCtx = canvas.getContext('2d');
    const visualizerContainer = document.querySelector('.visualizer-container');

    // ⚠️ GROQ API KEY 
    const GROQ_API_KEY = ""; // PASTE YOUR GROQ API KEY HERE FOR AI RESPONSES

    // ---- App State ----
    let isListening = false;
    let hasGreeted = false;
    let recognition = null;
    let synth = window.speechSynthesis;
    let interimElement = null;
    let currentLanguage = 'en-IN';
    let lastSpokenText = ''; // Guard against bot hearing itself
    let lastSpeechEndTime = 0; // Guard for echo delay
    let voices = []; // Global cache for voices
    
    // ---- Store State & Inventory (17 items) ----
    const inventory = {
        'tomato':    { stock: 2,   unit: 'kg',      price: 100, ta: 'தக்காளி',           taUnit: 'கிலோ' },
        'onion':     { stock: 10,  unit: 'kg',      price: 50,  ta: 'வெங்காயம்',         taUnit: 'கிலோ' },
        'potato':    { stock: 5,   unit: 'kg',      price: 40,  ta: 'உருளைக்கிழங்கு',   taUnit: 'கிலோ' },
        'milk':      { stock: 10,  unit: 'packets', price: 25,  ta: 'பால்',              taUnit: 'பாக்கெட்' },
        'apple':     { stock: 20,  unit: 'kg',      price: 200, ta: 'ஆப்பிள்',           taUnit: 'கிலோ' },
        'grapes':    { stock: 15,  unit: 'kg',      price: 150, ta: 'திராட்சை',          taUnit: 'கிலோ' },
        'spinach':   { stock: 5,   unit: 'kg',      price: 60,  ta: 'கீரை',              taUnit: 'கிலோ' },
        'banana':    { stock: 30,  unit: 'dozen',   price: 60,  ta: 'வாழைப்பழம்',       taUnit: 'டஜன்' },
        'rice':      { stock: 50,  unit: 'kg',      price: 55,  ta: 'அரிசி',             taUnit: 'கிலோ' },
        'eggs':      { stock: 100, unit: 'dozen',   price: 80,  ta: 'முட்டை',            taUnit: 'டஜன்' },
        'carrot':    { stock: 8,   unit: 'kg',      price: 70,  ta: 'கேரட்',             taUnit: 'கிலோ' },
        'cucumber':  { stock: 10,  unit: 'kg',      price: 40,  ta: 'வெள்ளரி',          taUnit: 'கிலோ' },
        'lemon':     { stock: 20,  unit: 'dozen',   price: 30,  ta: 'எலுமிச்சை',        taUnit: 'டஜன்' },
        'coconut':   { stock: 25,  unit: 'pcs',     price: 25,  ta: 'தேங்காய்',         taUnit: 'எண்' },
        'ginger':    { stock: 3,   unit: 'kg',      price: 120, ta: 'இஞ்சி',             taUnit: 'கிலோ' },
        'garlic':    { stock: 5,   unit: 'kg',      price: 150, ta: 'பூண்டு',            taUnit: 'கிலோ' },
        'coriander': { stock: 4,   unit: 'kg',      price: 80,  ta: 'கொத்தமல்லி',      taUnit: 'கிலோ' }
    };
    let cart = {}; // Tracks { "tomato": {qty: "2kg", price: 200, displayName: "tomato"} }
    let pendingOrder = null; // State for tracking dummy DB negotiation
    let pendingAlternative = false; // State for tracking if user wants something else after out-of-stock
    let pendingCheckout = false; // State for tracking checkout confirmation
    
    const orderTbody = document.getElementById('order-tbody');
    const downloadBtn = document.getElementById('download-btn');

    // ---- RAG: Generate product chunks from inventory ----
    function generateProductChunks(inv) {
        return Object.entries(inv).map(([key, item]) => ({
            id: `prod_${key}`,
            type: 'product',
            title: key.charAt(0).toUpperCase() + key.slice(1),
            keywords: [key, item.ta || '', item.unit || ''],
            content: `${key.charAt(0).toUpperCase() + key.slice(1)} costs \u20b9${item.price} per ${item.unit}. Stock: ${item.stock} ${item.unit} available.`,
            content_ta: `${item.ta} விலை \u20b9${item.price} ஒரு ${item.taUnit}. கையிருப்பு: ${item.stock} ${item.taUnit}.`
        }));
    }

    // Initialize RAG engine once DOM is ready
    if (typeof NovaRAG !== 'undefined' && typeof NOVA_STATIC_KB !== 'undefined') {
        const productChunks = generateProductChunks(inventory);
        NovaRAG.initialize(NOVA_STATIC_KB, productChunks);
    }

    // Audio Visualizer State
    let audioContext = null;
    let analyser = null;
    let microphoneStream = null;
    let animationId = null;

    // Set Initial Time
    initTime.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // ---- Supermarket AI Knowledge Base ----
    const supermarketDb = {
        'en-IN': {
            greeting: "Hi there! What can I get for you today?",
            not_understood: "I didn't quite get that, sir/madam. You can order items or ask about our store policies.",
            responses: [
                { keywords: ['hello', 'hi', 'hey'], reply: "Hello! Always happy to help. What are you looking for?" },
                { keywords: ['thank you', 'thanks', 'bye', 'goodbye'], reply: "No problem at all! Have a great day and come back soon." }
            ]
        },
        'ta-IN': {
            greeting: "வணக்கம்! இன்னைக்கு உங்களுக்கு என்ன வேணும்?",
            not_understood: "மன்னிக்கவும், எனக்கு புரியவில்லை. என்ன பொருட்கள் வேணும்னு சொல்லுங்க.",
            responses: [
                { keywords: ['வணக்கம்', 'ஹலோ'], reply: "வணக்கம்! இன்னைக்கு என்ன எடுத்து வைக்கட்டும்?" },
                { keywords: ['நன்றி', 'போய் வருகிறேன்', 'வர்ட்டா', 'பை'], reply: "மிக்க நன்றி! அப்புறம் பார்க்கலாம்!" }
            ]
        }
    };

    // ---- Speech Recognition Setup ----
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        recognition.continuous = true; 
        recognition.interimResults = true;
        recognition.lang = currentLanguage;

        recognition.onstart = () => {
            // isListening is already set to true in toggleMicrophone
            updateUIState();
            startVisualizer();
        };

        recognition.onend = () => {
            // Keep listening if we are in the active session
            if (isListening) {
                try {
                    recognition.start();
                } catch (e) {
                    // Already started or other error
                }
            } else {
                updateUIState();
                stopVisualizer();
            }
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // BARGE-IN & SELF-HEARING GUARD: 
            // We check if bot is speaking OR if we just finished speaking (10.0s cooldown for echo)
            const isBotActive = synth.speaking || (Date.now() - lastSpeechEndTime < 10000);

            const isEcho = (text) => {
                if (!isBotActive) return false;
                // Strips punctuation and makes lowercase
                const clean = (s) => s.toLowerCase().replace(/[.,?!]/g, '').trim();
                let qText = clean(text);
                if (currentLanguage.startsWith('ta')) {
                    qText = qText.replace(/\d+/g, (m) => numberToTamil(parseFloat(m)));
                } else if (currentLanguage.startsWith('en')) {
                    const enNums = { '0':'zero', '1':'one', '2':'two', '3':'three', '4':'four', '5':'five', '6':'six', '7':'seven', '8':'eight', '9':'nine'};
                    qText = qText.replace(/\b\d\b/g, (m) => enNums[m] || m);
                }
                const sText = clean(lastSpokenText);
                
                if (qText.length === 0) return false;
                
                // Block tiny audio bursts/speaker pops while bot is physically speaking directly
                if (synth.speaking && qText.length <= 2 && !['no', 'ok', 'ஆம்'].includes(qText)) return true;
                
                // 1. Precise Substring Match (with length guard)
                if (sText.includes(qText) && qText.length > 3) return true;

                // 2. Word Overlap with Homophone Handling (e.g., "to" matching "2" or "two")
                const qWords = qText.split(/\s+/).filter(w => w.length >= 2);
                const sWords = sText.split(/\s+/).filter(w => w.length >= 2);
                if (qWords.length === 0) return false;

                let overlap = 0;
                qWords.forEach(qw => {
                    const matchFound = sWords.some(sw => {
                        if (sw === qw || sw.includes(qw) || qw.includes(sw)) return true;
                        // English/Tamil common homophones/numbers
                        if (qw === 'to' && (sw === 'two' || sw === '2')) return true;
                        if (qw === 'for' && (sw === 'four' || sw === '4')) return true;
                        if (qw === 'one' && sw === '1') return true;
                        return false;
                    });
                    if (matchFound) overlap++;
                });
                
                const ratio = overlap / qWords.length;
                
                // "Fortress" Threshold: If > 50% words match AND it's not a short "yes"/"no", it's echo
                if (ratio > 0.5 && qText !== 'yes' && qText !== 'no' && qText !== 'ok') return true;
                
                // 3. Current sentence prefix match (handles "We only have...")
                if (qWords.length >= 3 && overlap >= 2 && sText.startsWith(qWords[0])) return true;

                return false;
            };

            if (isBotActive) {
                // If the whole final transcript or major interim part is echo, we filter
                if (finalTranscript.length > 0 && isEcho(finalTranscript)) {
                    return; 
                }
                
                // If it's NOT echo, it's a real barge-in
                if (synth.speaking && !isEcho(interimTranscript || finalTranscript)) {
                    synth.cancel();
                }
            }

            if (interimTranscript.length > 0) {
                if (!isEcho(interimTranscript)) {
                    updateInterimMessage(interimTranscript);
                }
            }

            if (finalTranscript.length > 0) {
                if (isEcho(finalTranscript)) {
                    removeInterimMessage();
                    return;
                }
                
                removeInterimMessage();
                addMessage(finalTranscript, 'user');
                processUserQuery(finalTranscript);
            }
        };


        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            if (event.error === 'not-allowed') {
                alert("⚠️ Microphone access denied!\n\nYou MUST run this using the XAMPP link (http://localhost/...) or VS Code Live Server. \nGoogle Chrome strictly blocks microphone access if you just double-click the file (file:///...).");
            } else if (event.error === 'network') {
                alert("⚠️ Web Speech API requires an active internet connection to transcribe voice.");
            } else if (event.error !== 'no-speech') {
                alert("Microphone error: " + event.error);
            }
            
            if (event.error !== 'no-speech') {
                isListening = false;
                updateUIState();
                stopVisualizer();
            }
        };

    } else {
        alert("Your browser does not support the Web Speech API. Please use Google Chrome for the full experience.");
        micBtn.disabled = true;
    }

    // ---- Logic Controller ----
    async function processUserQuery(query) {
        statusText.innerText = currentLanguage.startsWith('en') ? "Thinking..." : "சிந்திக்கிறது...";
        
        // ── RAG Retrieval (Available to both AI and Fallback) ───────
        let ragChunks = [];
        let topRagReply = null;
        if (typeof NovaRAG !== 'undefined' && NovaRAG.initialized) {
            ragChunks = NovaRAG.retrieve(query, 4, currentLanguage);
            if (ragChunks.length > 0) {
                topRagReply = currentLanguage.startsWith('ta') && ragChunks[0].content_ta ? ragChunks[0].content_ta : ragChunks[0].content;
            }
        }

        if (GROQ_API_KEY) {
            try {
                // ── Build Context from RAG ──────────────────────────
                let ragContextEn = '';
                let ragContextTa = '';
                if (ragChunks.length > 0) {
                    ragContextEn = '\n\nKNOWLEDGE BASE (answer non-ordering questions from here):\n' +
                        ragChunks.map(c => `[${c.title}]: ${c.content}`).join('\n');
                    ragContextTa = '\n\nஅறிவுத் தளம் (ஆர்டர் அல்லாத கேள்விகளுக்கு இதிலிருந்து பதில் சொல்லவும்):\n' +
                        ragChunks.map(c => `[${c.title}]: ${c.content_ta || c.content}`).join('\n');
                }

                // Build inventory and cart strings
                let invStr = Object.entries(inventory).map(([k, v]) => `${k}(stock:${v.stock}${v.unit},\u20b9${v.price}/${v.unit})`).join(', ');
                let cartStr = Object.keys(cart).length === 0 ? 'Empty' : Object.entries(cart).map(([k, v]) => `${k}: ${v.qty}`).join(', ');

                const systemPromptEn = `You are a friendly, casual grocery shop assistant. ${ragContextEn}

LIVE INVENTORY: ${invStr}. NEVER sell what's not in stock.
CURRENT CART: ${cartStr}.

RULES:
1. Tone: Friendly, casual, short (<15 words). Speak like a local assistant.
2. If user agrees (ok, seri, fine, right) → Say: "Okay, understood."
3. If user says nothing more → Ask: "Would you like to check out now, sir/madam?"
4. Delivery: We NEVER deliver. Clearly say: "We do not provide home delivery. Please visit our store in person."
5. Ordering: [ADD: item, quantity] or [REMOVE: item, quantity]. Use exact units from inventory.
6. Removing: 'Cancel', 'Remove', 'Delete', or 'I don't want' should all trigger [REMOVE].
7. Clear All: 'Clear cart', 'Remove all', 'Dont need anything', 'எதுவும் வேண்டாம்' should trigger [CLEAR_ALL].`;

                const systemPromptTa = `நீங்கள் ஒரு கனிவான கடை உதவியாளர். ${ragContextTa}

கையிருப்பு: ${invStr}.
தற்போதைய Cart: ${cartStr}.

விதிகள்:
1. பேச்சு வழக்கு தமிழில் சுருக்கமாக பதிலளிக்கவும்.
2. சரி, ஓகே என்று பயனர் சொன்னால்: "சரி, புரிந்தது." என்று கூறவும்.
3. பயனர் வேறு எதுவும் கேட்கவில்லை என்றால்: "இப்போது பில் போடலாமா?" என்று கேட்கவும்.
4. டெலிவரி: "நாங்கள் வீட்டிற்கு டெலிவரி செய்ய மாட்டோம். தயவு செய்து கடைக்கு நேரில் வரவும்." என்று தெளிவாக சொல்லவும்.
5. ஆர்டர் கட்டளைகள்: [ADD: பொருள், அளவு], [REMOVE: பொருள், அளவு].
6. நீக்குதல்: 'வேண்டாம்', 'இல்லை', 'கேன்சல்', 'நீக்கு', 'எடு' ஆகியவற்றை [REMOVE] ஆகக் கருதவும்.
   உதாரணம்: "தக்காளி வேண்டாம்" -> [REMOVE: தக்காளி].`;

                const systemPrompt = currentLanguage.startsWith('en') ? systemPromptEn : systemPromptTa;
                    
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${GROQ_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'llama3-8b-8192', // Fast model for voice
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: query }
                        ],
                        max_tokens: 150,
                        temperature: 0.7
                    })
                });
                
                const data = await response.json();
                if (data.choices && data.choices.length > 0) {
                    const replyText = data.choices[0].message.content.trim();
                    let cleanReply = replyText;
                    
                    // Parse Background Logic Commands [ADD: x, y] / [REMOVE: x, y]
                    const addRegex = /\[ADD:\s*([^,\]]+)[,:]?\s*([^\]]+)\]/gi;
                    const removeRegex = /\[REMOVE:\s*([^,\]]+)(?:[,:]?\s*([^\]]+))?\]/gi;
                    
                    let addMatch;
                    while ((addMatch = addRegex.exec(replyText)) !== null) {
                        const item = addMatch[1].trim().toLowerCase();
                        const qtyStr = addMatch[2].trim();
                        const newQtyNum = parseFloat(qtyStr) || 1;
                        
                        if (inventory[item]) {
                            const itemPrice = inventory[item].price;
                            const unit = inventory[item].unit;
                            
                            if (cart[item]) {
                                const currentQtyNum = parseFloat(cart[item].qty);
                                const totalQtyNum = currentQtyNum + newQtyNum;
                                cart[item] = { 
                                    qty: totalQtyNum + ' ' + unit, 
                                    price: totalQtyNum * itemPrice 
                                };
                            } else {
                                cart[item] = { 
                                    qty: newQtyNum + ' ' + unit, 
                                    price: newQtyNum * itemPrice 
                                };
                            }
                        }
                    }
                    
                    let removeMatch;
                    while ((removeMatch = removeRegex.exec(replyText)) !== null) {
                        const item = removeMatch[1].trim().toLowerCase();
                        const qtyStr = removeMatch[2] ? removeMatch[2].trim() : null;
                        
                        if (cart[item]) {
                            if (qtyStr) {
                                const subQtyNum = parseFloat(qtyStr);
                                const currentQtyNum = parseFloat(cart[item].qty);
                                const finalQtyNum = Math.max(0, currentQtyNum - subQtyNum);
                                
                                if (finalQtyNum === 0) {
                                    delete cart[item];
                                } else {
                                    const itemPrice = inventory[item] ? inventory[item].price : 0;
                                    const unit = inventory[item] ? inventory[item].unit : '';
                                    cart[item] = { 
                                        qty: finalQtyNum + ' ' + unit, 
                                        price: finalQtyNum * itemPrice 
                                    };
                                }
                            } else {
                                delete cart[item];
                            }
                        }
                    }
                    
                    // Strip commands so user doesn't hear/see them
                    cleanReply = cleanReply.replace(/\[ADD:[^\]]+\]/gi, '').replace(/\[REMOVE:[^\]]+\]/gi, '').trim();
                    
                    // IMPORTANT: Update UI if commands were processed
                    renderCart();
                    
                    // Only return if we have a non-empty reply to avoid stuck UI
                    if (cleanReply.length > 0) {
                        addMessage(cleanReply, 'system');
                        playVoice(cleanReply);
                        return;
                    } else if (replyText.includes('[ADD:') || replyText.includes('[REMOVE:')) {
                        // AI executed a command but forgot to talk. Give a default reply.
                        const defaultReply = currentLanguage.startsWith('en') ? "Done! Anything else?" : "சரி, வேறு என்ன வேண்டும்?";
                        addMessage(defaultReply, 'system');
                        playVoice(defaultReply);
                        return;
                    }
                }
            } catch (error) {
                console.error("Groq API Error:", error);
            }
        }
        
        // ------------------------------------
        // Dummy DB & Fallback Logic
        // ------------------------------------
        const q = query.toLowerCase();
        let reply = supermarketDb[currentLanguage].not_understood;

        // 0. Priority: Is this a specific Cancellation/Removal command?
        const removeIntentKeywords = ['remove', 'cancel', 'delete', 'subtract', 'minus', 'don\'t want', 'நீக்கு', 'வேண்டாம்', 'குறைக்க', 'எடுத்துடு', 'வேணாம்', 'குறை', 'திரும்பப் பெறு'];
        const isRemoveIntentRaw = removeIntentKeywords.some(kw => q.includes(kw));
        
        // Helper: Convert word numbers to actual digits
        const parseNumericWords = (text) => {
            const wordMap = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'half': 0.5, 'quarter': 0.25, 'ஒன்று': 1, 'ஒரு': 1, 'ஓர்': 1, 'இரண்டு': 2, 'ரெண்டு': 2, 'மூன்று': 3, 'நான்கு': 4, 'ஐந்து': 5, 'அரை': 0.5, 'கால்': 0.25, 'முக்கால்': 0.75, '¼': 0.25, '½': 0.5, '¾': 0.75 };
            const words = text.toLowerCase().split(/\s+/);
            for (let word of words) {
                if (wordMap[word]) return wordMap[word];
            }
            const fractionMatch = text.match(/(\d+)\/(\d+)/);
            if (fractionMatch) return parseFloat(fractionMatch[1]) / parseFloat(fractionMatch[2]);
            const digitMatch = text.match(/(\d+(?:\.\d+)?)/);
            return digitMatch ? parseFloat(digitMatch[0]) : null;
        };

        const hasNumbers = /\d+/.test(q) || ['one','two','three','four','five','half','ஒன்று','இரண்டு'].some(w => q.includes(w));
        const hasItems = Object.keys(inventory).some(k => q.includes(k) || (inventory[k].ta && q.includes(inventory[k].ta)));
        
        // If it's a clear removal command (has item or qty), skip the yes/no pending logic
        const skipPending = isRemoveIntentRaw && (hasNumbers || hasItems);

        // 1. Handle pending confirmations
        if (pendingCheckout && !skipPending) {
            const isYes = q.includes('yes') || q.includes('ok') || q.includes('okay') || q.includes('yeah') || q.includes('yep') || q.includes('sure') || q.includes('fine') || q.includes('enough') || q.includes('alright') || q.includes('that') || q.includes('ஆம்') || q.includes('சரி');
            const isNo = q.includes('no') || q.includes('nope') || q.includes('cancel') || q.includes('remove') || q.includes('don\'t') || q.includes('illai') || q.includes('இல்லை') || q.includes('வேண்டாம்');
            
            pendingCheckout = false; // Always clear it
            if (isYes && !isNo) {
                // Manually trigger checkout logic
                return processUserQuery('checkout');
            } else {
                reply = currentLanguage.startsWith('en') ? "Okay, no problem. Let me know if you need anything else." : "சரி, தங்களுக்கு வேறு ஏதேனும் வேண்டுமென்றால் கேட்கலாம்.";
            }
        } else if (pendingAlternative && !skipPending) {
            const isYes = q.includes('yes') || q.includes('ok') || q.includes('okay') || q.includes('yeah') || q.includes('yep') || q.includes('sure') || q.includes('fine') || q.includes('enough') || q.includes('alright') || q.includes('that') || q.includes('ஆம்') || q.includes('சரி');
            const isNo = q.includes('no') || q.includes('nope') || q.includes('cancel') || q.includes('remove') || q.includes('don\'t') || q.includes('illai') || q.includes('இல்லை') || q.includes('வேண்டாம்');
            
            pendingAlternative = false; // Clear it
            if (isYes && !isNo) {
                reply = currentLanguage.startsWith('en') ? "Sure! What would you like to order?" : "நிச்சயமாக! உங்களுக்கு என்ன பொருட்கள் வேண்டும்?";
            } else if (isNo) {
                pendingCheckout = true;
                reply = currentLanguage.startsWith('en') ? "No problem. Would you like to check out now?" : "சரி. இப்போது பில் போடலாமா?";
            } else {
                // If not a simple yes/no, let it fall through to standard processing
                reply = null;
            }
        } else if (pendingOrder && !skipPending) {
            const isYes = q.includes('yes') || q.includes('ok') || q.includes('okay') || q.includes('yeah') || q.includes('yep') || q.includes('sure') || q.includes('fine') || q.includes('enough') || q.includes('alright') || q.includes('that') || q.includes('ஆம்') || q.includes('சரி');
            const isNo = q.includes('no') || q.includes('nope') || q.includes('cancel') || q.includes('remove') || q.includes('don\'t') || q.includes('illai') || q.includes('இல்லை') || q.includes('வேண்டாம்');
            if (isYes && !isNo) {
                const existingPending = cart[pendingOrder.item];
                const prevQtyNum = existingPending ? parseFloat(existingPending.qty) : 0;
                const newQtyNum = parseFloat(pendingOrder.qty) + prevQtyNum;
                const newPrice = (existingPending ? existingPending.price : 0) + pendingOrder.price;
                const unit = inventory[pendingOrder.item].unit;
                cart[pendingOrder.item] = { qty: newQtyNum + ' ' + unit, price: newPrice };
                renderCart();
                const itemName = currentLanguage.startsWith('en') ? pendingOrder.item : inventory[pendingOrder.item].ta;
                reply = currentLanguage.startsWith('en') 
                    ? `Okay, I've added ${parseFloat(pendingOrder.qty)} ${unit} of ${pendingOrder.item} to your order. Total for ${pendingOrder.item}: ${newPrice} rupees. What else do you need?` 
                    : `${itemName} ஆர்டரில் சேர்க்கப்பட்டது. விலை ${newPrice} ரூபாய். வேறு என்ன வேண்டும்?`;
                pendingOrder = null;
            } else if (isNo) {
                pendingOrder = null;
                pendingCheckout = true;
                reply = currentLanguage.startsWith('en') ? "Okay, I won't add that. Would you like to check out instead?" : "சரி, சேர்க்கவில்லை. அதற்கு பதிலாக இப்போது பில் போடலாமா?";
            } else {
                pendingOrder = null; // reset if unrecognized answer
            }
        }        
        if (!reply || reply === supermarketDb[currentLanguage].not_understood) {
            // Helper: display name based on language
            const dispName = (key) => currentLanguage.startsWith('en') ? key : inventory[key].ta;
            const dispUnit = (key) => currentLanguage.startsWith('en') ? inventory[key].unit : inventory[key].taUnit;

            // Pre-scan for item name
            const items = Object.keys(inventory);
            let foundItemName = null;
            for (let key of items) {
                const item = inventory[key];
                if (q.includes(key) || (item.ta && q.includes(item.ta))) {
                    foundItemName = key;
                    break;
                }
            }

            
            // 1.5 Handle Menu / Inventory Queries
            const isMenuQuery = 
                (q.includes('what') || q.includes('which')) && (q.includes('item') || q.includes('product') || q.includes('have') || q.includes('sell')) ||
                q.includes('list') || q.includes('menu') || q.includes('inventory') ||
                q.includes('என்ன பொருட்கள்') || q.includes('என்னென்ன') || 
                q.includes('என்ன விக்கிறீர்கள்') || q.includes('என்ன கிடைக்கும்') ||
                (q.includes('என்ன') && (q.includes('பொருள்') || q.includes('பொருட்கள்') || q.includes('இருக்கிறது') || q.includes('உள்ளது')));
                
            if (isMenuQuery) {
                let itemList;
                if (currentLanguage.startsWith('en')) {
                    itemList = Object.entries(inventory).map(([k, v]) => `${k} at ${v.price} rupees per ${v.unit === 'kg' ? 'kg' : 'packet'}`).join(', ');
                    reply = `We currently have: ${itemList}. What would you like to order?`;
                } else {
                    itemList = Object.entries(inventory).map(([k, v]) => `${v.ta} - ${v.price} ரூபாய் ஒரு ${v.taUnit}`).join(', ');
                    reply = `எங்களிடம் இன்று கிடைக்கும் பொருட்கள்: ${itemList}. நீங்கள் என்ன வேண்டும்?`;
                }
                addMessage(reply, 'system');
                playVoice(reply, () => { try { recognition.start(); } catch(e){} });
                return;
            }

            // 1.6 Handle Checkout / Confirm Order
            const normalized = q.replace(/\s+/g, ''); // removes all spaces for matching
            const isCheckoutQuery = 
                (q.includes('confirm') && (q.includes('order') || q.includes('cart'))) ||
                normalized.includes('checkout') || q.includes('check out') ||
                q.includes('done ordering') || q.includes('finish') || q.includes('complete my order') ||
                (q.includes('done') && q.includes('order')) ||
                // Tamil checkout phrases
                q.includes('கன்ஃபர்ம்') || q.includes('கன்பார்ம்') || q.includes('முடித்துவிட்டேன்') ||
                q.includes('பில் போடுங்கள்') || q.includes('பில் போடு') || q.includes('ஆர்டர் முடிந்தது') ||
                (q.includes('ஆர்டர்') && (q.includes('முடிந்தது') || q.includes('கன்பார்ம்') || q.includes('உறுதிப்படுத்து')));
                
            if (isCheckoutQuery) {
                let totalC = 0;
                for (const item in cart) {
                    totalC += cart[item].price;
                }
                
                if (totalC === 0) {
                    reply = currentLanguage.startsWith('en') 
                        ? `Your order is currently empty. What would you like to buy?`
                        : `உங்கள் ஆர்டர் காலியாக உள்ளது. என்ன வேண்டும்?`;
                } else {
                    reply = currentLanguage.startsWith('en') 
                        ? `Thank you for ordering in our Nova supermarket! Your total is ${totalC} rupees.`
                        : `நோவா சூப்பர் மார்க்கெட்டில் ஆர்டர் செய்ததற்கு நன்றி! உங்கள் மொத்த பில் ${totalC} ரூபாய்.`;
                    
                    // Enable export button on checkout if cart not empty
                    downloadBtn.disabled = false;
                }
                
                addMessage(reply, 'system');
                playVoice(reply, () => { try { recognition.start(); } catch(e){} });
                return;
            }

            // 1.7 Handle Price / Cost Queries
            const priceIntentKeywords = ['price', 'cost', 'how much', 'rate', 'rupees', 'விலை', 'எவ்வளவு', 'ரூபாய்', 'பணம்', 'காசு'];
            const isPriceQuery = priceIntentKeywords.some(kw => q.includes(kw));
            
            if (isPriceQuery) {
                // Case A: Total Cart Cost
                if (q.includes('total') || q.includes('totally') || q.includes('full') || q.includes('மொத்தம்')) {
                    let totalC = 0;
                    for (const item in cart) {
                        totalC += cart[item].price;
                    }
                    if (totalC === 0) {
                        reply = currentLanguage.startsWith('en') ? "Your cart is empty." : "உங்கள் கூடை காலியாக உள்ளது.";
                    } else {
                        reply = currentLanguage.startsWith('en') ? `Your total is ${totalC} rupees.` : `உங்கள் மொத்த பில் ${totalC} ரூபாய்.`;
                    }
                } 
                // Case B: Specific Item Price
                else if (foundItemName) {
                    const price = inventory[foundItemName].price;
                    const unit = dispUnit(foundItemName);
                    const name = dispName(foundItemName);
                    reply = currentLanguage.startsWith('en') 
                        ? `The price of ${foundItemName} is ${price} rupees per ${unit}.`
                        : `${name} விலை ஒரு ${unit} ${price} ரூபாய்.`;
                } else {
                    reply = currentLanguage.startsWith('en') ? "Which item's price would you like to know?" : "எந்தப் பொருளின் விலை உங்களுக்கு வேண்டும்?";
                }
                
                addMessage(reply, 'system');
                playVoice(reply, () => { try { recognition.start(); } catch(e){} });
                return;
            }

            // 2. Identify Intent & Item for Ordering/Removal
            const orderIntentKeywords = ['order', 'buy', 'need', 'want', 'give', 'have', 'add', 'ஆர்டர்', 'வேண்டும்', 'வேணும்', 'கொடுங்க', 'இருக்கா', 'சேர்த்துவிடு', 'போடுங்க'];
            const isOrderIntent = orderIntentKeywords.some(kw => q.includes(kw));
            
            // Scan for item name (already pre-scanned above)
            // No changes needed, foundItemName is available


            // A. Handle Removal Logic First
            if (isRemoveIntentRaw) {
                const qtyToSub = parseNumericWords(q) || 999;
                
                // If item not explicitly named, look in cart
                if (!foundItemName) {
                    for (const item in cart) {
                        if (q.includes(item) || (inventory[item].ta && q.includes(inventory[item].ta))) {
                            foundItemName = item;
                            break;
                        }
                    }
                }

                if (foundItemName && cart[foundItemName]) {
                    const currentQty = parseFloat(cart[foundItemName].qty);
                    const finalQty = Math.max(0, currentQty - qtyToSub);
                    const unit = inventory[foundItemName].unit;
                    const name = dispName(foundItemName);
                    
                    if (finalQty <= 0) {
                        delete cart[foundItemName];
                        reply = currentLanguage.startsWith('en') 
                            ? `Successfully removed all ${foundItemName} from your order.` 
                            : `உங்கள் ஆர்டரிலிருந்து ${name} முழுவதும் நீக்கப்பட்டது.`;
                    } else {
                        const itemPrice = inventory[foundItemName].price;
                        cart[foundItemName] = { 
                            qty: finalQty + ' ' + unit, 
                            price: finalQty * itemPrice 
                        };
                        reply = currentLanguage.startsWith('en')
                            ? `Cancelled ${qtyToSub === 999 ? 'all' : qtyToSub} ${unit} of ${foundItemName}. You now have ${finalQty} ${unit}.`
                            : `${qtyToSub === 999 ? 'அனைத்து' : qtyToSub} ${dispUnit(foundItemName)} ${name} நீக்கப்பட்டது. மீதம்: ${finalQty} ${dispUnit(foundItemName)}.`;
                    }
                    renderCart();
                } else {
                    reply = currentLanguage.startsWith('en')
                        ? "I couldn't find that item in your order to cancel. Which item should I remove?"
                        : "உங்கள் ஆர்டரில் அந்தப் பொருளை என்னால் கண்டுபிடிக்க முடியவில்லை. எதை நீக்க வேண்டும்?";
                }
            } 
            // B. Handle Ordering Logic
            else if (foundItemName) {
                let reqQty = 1;
                const fractionMatch = q.match(/(\d+)\/(\d+)/);
                const match = q.match(/(\d+(?:\.\d+)?)/);
                if (fractionMatch) {
                    reqQty = parseFloat(fractionMatch[1]) / parseFloat(fractionMatch[2]);
                } else if (match) {
                    reqQty = parseFloat(match[1]);
                } else {
                    const parsed = parseNumericWords(q);
                    if (parsed !== null) reqQty = parsed;
                }
                const totalStock = inventory[foundItemName].stock;
                
                const cartData = cart[foundItemName];
                const alreadyOrdered = cartData ? parseFloat(cartData.qty) : 0;
                const remainingStock = totalStock - alreadyOrdered;

                if (remainingStock <= 0) {
                    const name = dispName(foundItemName);
                    const unit = dispUnit(foundItemName);
                    reply = currentLanguage.startsWith('en') 
                        ? `I'm sorry! ${foundItemName} is out of stock. You've already ordered all ${totalStock} ${unit}.`
                        : `மன்னிக்கவும்! ${name} இருப்பு தீர்ந்து வி்ட்டது. ஏற்கனவே ${totalStock} ${unit} ஆர்டர் செய்யப்பட்டுள்ளது.`;
                    pendingAlternative = true;
                } else if (reqQty > remainingStock) {
                    const cost = remainingStock * inventory[foundItemName].price;
                    pendingOrder = { item: foundItemName, qty: remainingStock + ' ' + inventory[foundItemName].unit, price: cost };
                    reply = currentLanguage.startsWith('en')
                        ? `We only have ${remainingStock} ${inventory[foundItemName].unit} of ${foundItemName} left. Is that okay?`
                        : `${dispName(foundItemName)} மீதம் ${remainingStock} ${dispUnit(foundItemName)} மட்டுமே உள்ளது. பரவாயில்லையா?`;
                } else {
                    const cost = reqQty * inventory[foundItemName].price;
                    const existing = cart[foundItemName];
                    const prevQtyNum = existing ? parseFloat(existing.qty) : 0;
                    const totalQtyNum = prevQtyNum + reqQty;
                    const totalCost = (existing ? existing.price : 0) + cost;
                    const unit = inventory[foundItemName].unit;
                    
                    cart[foundItemName] = { qty: totalQtyNum + ' ' + unit, price: totalCost };
                    renderCart();
                    reply = currentLanguage.startsWith('en') 
                        ? `Added ${reqQty} ${unit} of ${foundItemName}. Total for ${foundItemName}: ${totalCost} rupees.`
                        : `${reqQty} ${dispUnit(foundItemName)} ${name} ஆர்டரில் சேர்க்கப்பட்டது. மொத்தம் ${totalCost} ரூபாய்.`;
                }
            } 
            // C. Keyword Fallback
            else {
                if (isOrderIntent) {
                    reply = currentLanguage.startsWith('en') 
                        ? "I'm sorry, we don't carry that item. Would you like to order something else?"
                        : "மன்னிக்கவும், அந்தப் பொருள் எங்களிடம் இல்லை. வேறு ஏதேனும் வேண்டுமென்றால் கேட்கலாம்.";
                    pendingAlternative = true;
                } else if (topRagReply) {
                    // Use RAG Knowledge as the primary fallback!
                    reply = topRagReply;
                } else {
                    for (const rule of supermarketDb[currentLanguage].responses) {
                        if (rule.keywords.some(kw => q.includes(kw))) {
                            reply = rule.reply;
                            break;
                        }
                    }
                }
            }
        }

        // Respond
        addMessage(reply, 'system');
        playVoice(reply);
    }

    // ---- Text to Speech (TTS) Helper ----
    // Helper: Convert digit numbers to Tamil words for TTS
    function numberToTamil(n) {
        if (n === 0) return "பூஜ்ஜியம்";
        const units = ["", "ஒன்று", "இரண்டு", "மூன்று", "நான்கு", "ஐந்து", "ஆறு", "ஏழு", "எட்டு", "ஒன்பது"];
        const teens = ["பத்து", "பதினொன்று", "பன்னிரண்டு", "பதின்மூன்று", "பதினான்கு", "பதினைந்து", "பதினாறு", "பதினேழு", "பதினெட்டு", "பத்தொன்பது"];
        const tens = ["", "", "இருபது", "முப்பது", "நாற்பது", "ஐம்பது", "அறுபது", "எழுபது", "எண்பது", "தொண்ணூறு"];
        const hundreds = ["", "நூறு", "இருநூறு", "முன்னூறு", "நானூறு", "ஐந்நூறு", "அறுநூறு", "எழுநூறு", "எண்நூறு", "தொள்ளாயிரம்"];
        
        if (n < 10) return units[n];
        if (n < 20) return teens[n-10];
        if (n < 100) return tens[Math.floor(n/10)] + (n%10 > 0 ? " " + units[n%10] : "");
        if (n < 1000) return hundreds[Math.floor(n/100)] + (n%100 > 0 ? " " + numberToTamil(n%100) : "");
        return n.toString(); // Fallback
    }
    
    // ---- Voice Pre-loading ----
    function loadVoices() {
        voices = synth.getVoices();
        if (voices.length > 0) {
            console.log("Voices loaded:", voices.length);
        }
    }
    
    // Initial load attempt
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }

    const playVoice = (text, onComplete) => {
        if (synth.speaking) synth.cancel();
        
        if (!text || text.trim().length === 0) {
            if (onComplete) onComplete();
            return;
        }

        // Ensure voices are loaded; if not, try one more time
        if (voices.length === 0) {
            loadVoices();
        }

        let voiceText = text;
        if (currentLanguage.startsWith('ta')) {
            // Replace digits with Tamil words for better pronunciation and echo matching
            voiceText = voiceText.replace(/\d+/g, (m) => numberToTamil(parseInt(m)));
        } else if (currentLanguage.startsWith('en')) {
            // Wordify common single digits for better English echo guard matching
            const enNums = { '0':'zero', '1':'one', '2':'two', '3':'three', '4':'four', '5':'five', '6':'six', '7':'seven', '8':'eight', '9':'nine'};
            voiceText = voiceText.replace(/\b\d\b/g, (m) => enNums[m] || m);
        }

        lastSpokenText = voiceText; // Use the wordified version for better echo cancellation

        const utterThis = new SpeechSynthesisUtterance(voiceText);
        utterThis.lang = currentLanguage;

        // --- Robust Voice Selection Logic ---
        let preferredVoice = null;
        
        if (voices.length > 0) {
            // 1. Try to find the exact lang match, prioritizing "Google" voices
            preferredVoice = voices.find(v => v.lang === currentLanguage && v.name.includes('Google'));
            
            // 2. Try any exact lang match
            if (!preferredVoice) {
                preferredVoice = voices.find(v => v.lang === currentLanguage);
            }
            
            // 3. Try partial lang match (e.g., 'ta' for 'ta-IN')
            if (!preferredVoice) {
                const shortLang = currentLanguage.split('-')[0];
                preferredVoice = voices.find(v => v.lang.startsWith(shortLang) && v.name.includes('Google'));
                if (!preferredVoice) {
                    preferredVoice = voices.find(v => v.lang.startsWith(shortLang));
                }
            }
            
            // 4. Special case for Tamil: look for 'Tamil' in the name
            if (!preferredVoice && currentLanguage.startsWith('ta')) {
                preferredVoice = voices.find(v => v.name.toLowerCase().includes('tamil'));
            }
        }
        
        if (preferredVoice) {
            utterThis.voice = preferredVoice;
            console.log("Selected voice:", preferredVoice.name, preferredVoice.lang);
        } else {
            console.warn("No preferred voice found for", currentLanguage, ". Using system default.");
        }


        window.currentUtterance = utterThis;
        utterThis.rate = 1.0;
        utterThis.pitch = 1.0;
        utterThis.volume = 1.0;

        utterThis.onstart = () => {
            statusBadge.classList.remove('listening');
            statusBadge.classList.add('speaking');
            statusText.innerText = currentLanguage.startsWith('en') ? "Speaking..." : "பேசுகிறது...";
        };

        utterThis.onend = () => {
            lastSpeechEndTime = Date.now(); // Record when speech finished
            statusBadge.classList.remove('speaking');
            
            if (onComplete) onComplete();
            
            // Revert UI state
            if (isListening) {
                updateUIState();
            } else {
                statusBadge.classList.remove('listening');
                statusText.innerText = currentLanguage.startsWith('en') ? "System Ready" : "தயார்";
            }
        };

        utterThis.onerror = (e) => {
            console.error("Speech Synthesis Error:", e);
            utterThis.onend();
        };


        try {
            synth.speak(utterThis);
        } catch(e) {
            console.error("Speech error:", e);
        }
    };

    // ---- Real-time Audio Visualizer ----
    async function startVisualizer() {
        if (audioContext && audioContext.state === 'running') return;
        if (audioContext && audioContext.state === 'suspended') {
            await audioContext.resume();
            return;
        }
        
        try {
            // Adjust canvas size to match container
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            
            // Re-use existing stream if available
            if (!microphoneStream) {
                microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            }
            const stream = microphoneStream;
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            
            source.connect(analyser);
            analyser.fftSize = 64; // Low resolution for sleek bar effect
            
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            visualizerContainer.classList.add('active');

            function draw() {
                animationId = requestAnimationFrame(draw);
                analyser.getByteFrequencyData(dataArray);
                
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                
                const barWidth = (canvas.width / bufferLength) * 1.5;
                let x = 0;
                
                // Draw symmetrical from center for a premium look
                const centerX = canvas.width / 2;
                
                for (let i = 0; i < bufferLength; i++) {
                    // Smooth data mapping
                    const v = dataArray[i] / 255.0;
                    const barHeight = (v * canvas.height * 0.8) + 2; // minimum height 2
                    
                    // Emerald gradient
                    const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
                    gradient.addColorStop(0, "rgba(16, 185, 129, 0.1)");
                    gradient.addColorStop(1, "rgba(16, 185, 129, 1)");
                    
                    canvasCtx.fillStyle = gradient;
                    
                    // Draw mirror left and right
                    const offset = i * (barWidth + 4);
                    
                    // Right side
                    canvasCtx.beginPath();
                    canvasCtx.roundRect(centerX + offset, canvas.height - barHeight, barWidth, barHeight, [4, 4, 0, 0]);
                    canvasCtx.fill();
                    
                    // Left side
                    if (i > 0) {
                        canvasCtx.beginPath();
                        canvasCtx.roundRect(centerX - offset, canvas.height - barHeight, barWidth, barHeight, [4, 4, 0, 0]);
                        canvasCtx.fill();
                    }
                }
            }
            
            draw();
            
        } catch (err) {
            console.error("Error accessing microphone for visualizer:", err);
            // Non-blocking: Visualizer just won't show
        }
    }

    function stopVisualizer() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        if (microphoneStream) {
            microphoneStream.getTracks().forEach(track => track.stop());
            microphoneStream = null;
        }
        
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
            audioContext = null;
        }
        
        visualizerContainer.classList.remove('active');
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // ---- Event & UI Handlers ----
    async function toggleMicrophone() {
        if (!recognition) return;

        // Visual click feedback
        micBtn.style.transform = 'scale(0.9)';
        setTimeout(() => micBtn.style.transform = '', 150);

        if (isListening) {
            isListening = false;
            recognition.stop();
            if (synth.speaking) synth.cancel();
            return;
        } 

        // CRITICAL FIX: Chrome sometimes silently blocks SpeechRecognition on HTTP ports.
        // By forcing getUserMedia first, we guarantee the browser shows the "Allow Microphone" popup!
        try {
            if (!microphoneStream) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                microphoneStream = stream; // Store it so visualizer can use it later
            }
        } catch (err) {
            alert("Error: Microphone permission was denied or no microphone was found! Please click the lock icon in the URL bar and allow microphone access.");
            return;
        }

        if (synth.speaking) synth.cancel();

        isListening = true; // Mark as active session
        updateUIState();
        startVisualizer();

        if (!hasGreeted) {
            hasGreeted = true;
            transcriptContainer.innerHTML = '';
            addMessage(supermarketDb[currentLanguage].greeting, 'system');
            
            // Small delay to ensure voices are loaded on first click
            setTimeout(() => {
                playVoice(supermarketDb[currentLanguage].greeting);
            }, 100);
        }
        
        try { recognition.start(); } catch(e) {}
    }

    function updateUIState() {
        if (isListening) {
            micBtn.classList.add('active');
            micWrapper.classList.add('active');
            statusBadge.classList.add('listening');
            statusText.innerText = currentLanguage.startsWith('en') ? "Listening..." : "கேட்கிறது...";
        } else {
            micBtn.classList.remove('active');
            micWrapper.classList.remove('active');
            
            if(!synth.speaking) {
                statusBadge.classList.remove('listening');
                statusText.innerText = currentLanguage.startsWith('en') ? "System Ready" : "தயார்";
            }
        }
    }

    function formatTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        
        // Avatar
        const iconDiv = document.createElement('div');
        iconDiv.className = 'avatar';
        iconDiv.innerHTML = sender === 'system' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
        
        // Body wrapper
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'message-body';

        // Content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        contentDiv.innerText = text;
        
        // Time
        const timeDiv = document.createElement('div');
        timeDiv.className = 'timestamp';
        timeDiv.innerText = formatTime();

        bodyDiv.appendChild(contentDiv);
        bodyDiv.appendChild(timeDiv);

        msgDiv.appendChild(iconDiv);
        msgDiv.appendChild(bodyDiv);
        
        transcriptContainer.appendChild(msgDiv);
        scrollToBottom();
    }

    function updateInterimMessage(text) {
        if (!interimElement) {
            interimElement = document.createElement('div');
            interimElement.className = 'message user interim-wrapper';
            
            const iconDiv = document.createElement('div');
            iconDiv.className = 'avatar';
            iconDiv.innerHTML = '<i class="fas fa-user"></i>';
            
            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'message-body';

            const contentDiv = document.createElement('div');
            contentDiv.className = 'content interim';
            
            bodyDiv.appendChild(contentDiv);
            interimElement.appendChild(iconDiv);
            interimElement.appendChild(bodyDiv);
            
            transcriptContainer.appendChild(interimElement);
        }
        
        interimElement.querySelector('.content').innerText = text;
        scrollToBottom();
    }

    function removeInterimMessage() {
        if (interimElement) {
            interimElement.remove();
            interimElement = null;
        }
    }

    function scrollToBottom() {
        transcriptContainer.scrollTo({
            top: transcriptContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    // Listeners
    micBtn.addEventListener('click', toggleMicrophone);

    languageRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentLanguage = e.target.value;
            if (recognition) {
                if (isListening) {
                    recognition.stop();
                }
                recognition.lang = currentLanguage;
            }
            
            // Clear history and add new language greeting
            transcriptContainer.innerHTML = '';
            const greeting = supermarketDb[currentLanguage].greeting;
            addMessage(greeting, 'system');
            updateUIState();
            
            // Auto-speak greeting when language is switched
            playVoice(greeting, () => { if (isListening) try { recognition.start(); } catch(e){} });
        });
    });

    // UI functions
    function renderCart() {
        orderTbody.innerHTML = '';
        const items = Object.keys(cart);
        
        if (items.length === 0) {
            orderTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--text-muted);">Your order is empty</td></tr>';
            return;
        }
        
        let totalC = 0;
        items.forEach(item => {
            const data = cart[item];
            totalC += data.price;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-transform: capitalize;">${item}</td>
                <td><span style="background: rgba(16, 185, 129, 0.2); color: var(--primary); padding: 4px 8px; border-radius: 4px; font-weight: 500;">${data.qty}</span></td>
                <td>₹${data.price}</td>
            `;
            orderTbody.appendChild(tr);
        });
        
        const trTotal = document.createElement('tr');
        trTotal.innerHTML = `<td colspan="2" style="text-align: right; font-weight: 600;">Total:</td><td style="font-weight: 600; color: var(--primary);">₹${totalC}</td>`;
        orderTbody.appendChild(trTotal);
    }

    // Export Excel/CSV
    downloadBtn.addEventListener('click', () => {
        let csvContent = "data:text/csv;charset=utf-8,Item,Quantity,Price\n";
        let total = 0;
        for (const [item, data] of Object.entries(cart)) {
            csvContent += `${item},${data.qty},${data.price}\n`;
            total += data.price;
        }
        csvContent += `Total,,${total}\n`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "nova_fresh_order.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // ---- RAG Sources Panel UI ----------------------------------------
    function showRAGSources(chunks) {
        if (!ragSourcesPanel) return;
        if (!chunks || chunks.length === 0) {
            ragSourcesPanel.classList.remove('visible');
            return;
        }
        ragChunkCount.textContent = chunks.length;
        ragSourcesBody.innerHTML = '';
        chunks.forEach((chunk, i) => {
            const item = document.createElement('div');
            item.className = 'rag-chunk-item';
            item.style.animationDelay = `${i * 0.07}s`;
            const snippet = (chunk.displayContent || chunk.content || '').slice(0, 75) + '…';
            const typeClass = 'rag-type-' + (chunk.type || 'product');
            item.innerHTML =
                `<span class="rag-type-badge ${typeClass}">${(chunk.type||'').replace('_',' ')}</span>` +
                `<span class="rag-chunk-title">${chunk.title || chunk.id}</span>` +
                `<span class="rag-chunk-snippet">${snippet}</span>` +
                `<span class="rag-chunk-score">${chunk.score}</span>`;
            ragSourcesBody.appendChild(item);
        });
        ragSourcesPanel.classList.remove('collapsed');
        ragSourcesPanel.classList.add('visible');
        if (ragChevron) ragChevron.style.transform = '';
    }

    // Toggle collapse of sources panel
    if (ragSourcesToggle) {
        ragSourcesToggle.addEventListener('click', () => {
            const isCollapsed = ragSourcesPanel.classList.toggle('collapsed');
            if (ragChevron) ragChevron.style.transform = isCollapsed ? 'rotate(180deg)' : '';
        });
    }
});

