/**
 * Nova Fresh Supermarket — Static Knowledge Base
 */
const NOVA_STATIC_KB = [
    {
        id: "delivery_policy",
        type: "faq",
        title: "Home Delivery",
        keywords: ["delivery", "deliver", "dispatch", "ship", "send", "home delivery"],
        content: "We do not provide home delivery. Please visit the store in person to collect and pay for your items.",
        content_ta: "நாங்கள் வீட்டிற்கு டெலிவரி செய்ய மாட்டோம். தயவு செய்து கடைக்கு நேரில் வந்து பொருட்களைப் பெற்றுக்கொள்ளவும்."
    },
    {
        id: "removing_items",
        type: "conversation",
        title: "Removing Items",
        keywords: ["remove", "cancel", "delete", "reduce", "don't want", "take out", "வேண்டாம்", "இல்லை", "கேன்சல்", "நீக்கு", "குறைக்கவும்"],
        content: "I have removed the item from your cart. Let me know if you want to add anything else.",
        content_ta: "உங்கள் கூடையிலிருந்து அந்தப் பொருளை நீக்கிவிட்டேன். வேறு ஏதேனும் வேண்டுமா?"
    },
    {
        id: "clear_all",
        type: "conversation",
        title: "Clear All",
        keywords: ["clear cart", "remove all", "don't need anything", "nothing needed", "எதுவும் வேண்டாம்", "எல்லாவற்றையும் நீக்கு", "எல்லாத்தையும் நீக்கு", "எதுவுமே வேண்டாம்"],
        content: "I have cleared everything from your cart. It is now empty.",
        content_ta: "உங்கள் கூடையில் உள்ள அனைத்து பொருட்களையும் நீக்கிவிட்டேன். இப்போது அது காலியாக உள்ளது."
    },
    {
        id: "acknowledgement",
        type: "conversation",
        title: "User Agreement",
        keywords: ["ok", "okay", "fine", "right", "seri", "சரி", "அப்படியா", "நல்லது"],
        content: "Okay, understood. Everything is set.",
        content_ta: "சரி, புரிந்தது. எல்லாம் சரியாக உள்ளது."
    },
    {
        id: "continue_order",
        type: "conversation",
        title: "Continue Order",
        keywords: ["continue", "next", "what else", "order more", "anything else"],
        content: "What would you like to order next, sir/madam?",
        content_ta: "அடுத்தது என்ன ஆர்டர் செய்ய விரும்புகிறீர்கள்?"
    },
    {
        id: "no_more_order",
        type: "conversation",
        title: "No More Items",
        keywords: ["nothing", "no", "done", "enough", "bill podu", "bill podungal", "pothum", "checkout", "bil", "bill", "stop", "enough order", "வேண்டாம்", "இல்லை", "போதும்", "பில் போடு", "பில் போடுங்க", "எதுவும் வேண்டாம்"],
        content: "Certainly! I've prepared your bill for you. You can check the order sheet right below.",
        content_ta: "சரிங்க! இதோ உங்களுக்கான பில் தயாராகிவிட்டது. கீழே உள்ள லிஸ்ட்டை சரிபார்த்துக் கொள்ளுங்கள்."
    },
    {
        id: "thanks",
        type: "conversation",
        title: "Thanks",
        keywords: ["thanks", "thank you", "nandri", "நன்றி", "மிக்க நன்றி"],
        content: "You are welcome! Visit again.",
        content_ta: "மிக்க நன்றி! மீண்டும் வருக!"
    },
    {
        id: 'store_timings', type: 'store_info', title: 'Store Timings',
        keywords: ['timing','open','hours','schedule','நேரம்','திறக்கும்'],
        content: 'We are open from 8:00 AM to 10:00 PM every day.',
        content_ta: 'நாங்கள் தினமும் காலை 8 மணி முதல் இரவு 10 மணி வரை திறந்திருப்போம்.'
    }
];
