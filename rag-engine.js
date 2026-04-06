/**
 * Nova Fresh — BM25 RAG Engine
 * Pure JavaScript, zero external dependencies.
 * Usage: NovaRAG.initialize(staticKB, productChunks)
 *        NovaRAG.retrieve(query, topK, lang)
 */
(function (global) {
    'use strict';

    const K1 = 1.5, B = 0.75;

    const STOPWORDS = new Set([
        'the','a','an','is','are','was','were','be','been','have','has','had',
        'do','does','did','will','would','shall','should','may','might','can',
        'could','to','of','in','for','on','with','at','by','from','and','or',
        'but','if','i','you','we','they','it','my','your','our','this','that',
        'these','those','am','its','get','go','me','him','her','us','them'
    ]);

    const SYNONYMS = {
        dispatch: "delivery",
        ship: "delivery",
        send: "delivery"
    };

    function tokenize(text) {
        if (!text) return [];
        let t = text.toLowerCase();
        
        // Synonym expansion
        Object.keys(SYNONYMS).forEach(key => {
            if (t.includes(key)) {
                t += " " + SYNONYMS[key];
            }
        });

        return t
            .replace(/[.,!?;:'"()\[\]{}\-₹@#%&*+=\/<>]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length >= 1 && !STOPWORDS.has(t));
    }

    class BM25 {
        constructor() {
            this.docs = [];
            this.inv = {};        // inverted index: term -> [{idx, freq}]
            this.lens = [];       // doc lengths
            this.avgLen = 0;
        }

        build(docs) {
            this.docs = docs;
            this.inv = {};
            this.lens = [];
            let total = 0;

            docs.forEach((doc, idx) => {
                const txt = [
                    doc.content || '',
                    doc.content_ta || '',
                    (doc.keywords || []).join(' '),
                    doc.title || '',
                    doc.type || ''
                ].join(' ');

                const tokens = tokenize(txt);
                this.lens[idx] = tokens.length;
                total += tokens.length;

                const tf = {};
                tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });

                Object.entries(tf).forEach(([term, freq]) => {
                    if (!this.inv[term]) this.inv[term] = [];
                    this.inv[term].push({ idx, freq });
                });
            });

            this.avgLen = docs.length ? total / docs.length : 1;
        }

        score(queryTokens, docIdx) {
            const N = this.docs.length;
            const dl = this.lens[docIdx] || 1;
            let s = 0;

            queryTokens.forEach(term => {
                const postings = this.inv[term];
                if (!postings) return;
                const df = postings.length;
                const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
                const p = postings.find(x => x.idx === docIdx);
                if (!p) return;
                const tf = p.freq;
                const tfn = (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * dl / this.avgLen));
                s += idf * tfn;
            });
            return s;
        }
    }

    class RAGEngine {
        constructor() {
            this.bm25 = new BM25();
            this.docs = [];
            this.initialized = false;
        }

        initialize(staticKB, productChunks) {
            this.docs = [...(staticKB || []), ...(productChunks || [])];
            this.bm25.build(this.docs);
            this.initialized = true;
            console.log(
                `%c[NovaRAG] ✅ BM25 index built — ${this.docs.length} documents`,
                'color:#10B981;font-weight:bold;'
            );
        }

        retrieve(query, topK = 4, lang = 'en-IN') {
            if (!this.initialized || !query) return [];
            const qTokens = tokenize(query);
            if (!qTokens.length) return [];

            const qLower = query.toLowerCase();
            const isTa = lang.startsWith('ta');

            const scored = this.docs.map((doc, idx) => {
                let score = this.bm25.score(qTokens, idx);

                // Exact keyword boost - extremely high to ensure pinpoint accuracy
                const kwHit = (doc.keywords || []).some(kw =>
                    qLower.includes(kw.toLowerCase()) ||
                    kw.toLowerCase().includes(qLower.split(' ')[0])
                );
                if (kwHit) score += 10.0;

                // Language boost
                if (isTa && doc.content_ta) score += 0.4;

                // Type-specific boosts
                if (/(time|open|close|hour|நேரம்|திறக்கும்|மூடும்)/.test(qLower) && doc.type === 'store_info') score += 1.5;
                if (/(return|refund|exchange|திரும்ப)/.test(qLower) && doc.type === 'faq') score += 1.5;
                if (/(offer|discount|deal|sale|சலுகை|ஆஃபர்)/.test(qLower) && doc.type === 'promotion') score += 1.5;
                if (/(delivery|deliver|home|டெலிவரி)/.test(qLower) && doc.id === 'faq_delivery') score += 1.5;
                if (/(recipe|cook|make|ingredient|சமையல்|செய்ய)/.test(qLower) && doc.type === 'recipe') score += 1.5;

                return { doc, score };
            });

            scored.sort((a, b) => b.score - a.score);

            return scored
                .slice(0, topK)
                .filter(s => s.score > 0.05)
                .map(s => ({
                    ...s.doc,
                    score: parseFloat(s.score.toFixed(2)),
                    displayContent: isTa && s.doc.content_ta ? s.doc.content_ta : s.doc.content
                }));
        }

        // Call when inventory changes to keep product chunks fresh
        refresh(staticKB, productChunks) {
            this.initialize(staticKB, productChunks);
        }
    }

    global.NovaRAG = new RAGEngine();

})(window);
