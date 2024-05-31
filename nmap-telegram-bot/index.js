const TelegramBot = require('node-telegram-bot-api');
const { Configuration, OpenAIApi } = require('openai');
const { exec } = require('execa'); 

const token = '7379088123:AAF69W2YNv4t04STq4J_c0jVtBzJ8yOQe3Q';
const openaiApiKey = 'sk-proj-yGTvrdRghoJSYD0yslrrT3BlbkFJxS7qeql5ak1HUeAZW5g2'; 

const bot = new TelegramBot(token, { polling: true });
const openai = new OpenAIApi(new Configuration({ apiKey: openaiApiKey }));

const scanOptions = [
    ['Network Discovery (Ping Scan)', '-sn'],
    ['TCP Connect Scan', '-sT'],
    ['TCP SYN (Stealth) Scan', '-sS'],
    ['UDP Scan', '-sU'],
    ['OS Detection', '-O'],
    ['Version Detection', '-sV'],
    ['Vulnerability Scan', '-sV --script vuln'],
    ['Aggressive Scan', '-A'],
    ['Intense Scan', '-T4 -A -v'],
    ['Custom Scan', 'custom']
];

bot.onText(/\/start/, sendWelcomeMessage);
bot.on('callback_query', handleCallbackQuery);

function sendWelcomeMessage(msg) {
    const startMessage = "Welcome to the Security Bot! Choose a tool:";
    const keyboard = {
        inline_keyboard: [
            [{ text: 'GoLinkFinder', callback_data: 'goLinkFinder' }],
            [{ text: 'CVE Lookup (CVEMap)', callback_data: 'cvemap' }],
            [{ text: 'Nmap Network Scans', callback_data: 'nmap' }],
        ],
    };
    bot.sendMessage(msg.chat.id, startMessage, { reply_markup: keyboard });
}

async function handleCallbackQuery(query) {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
        switch (data) {
            case 'goLinkFinder':
                handleGoLinkFinder(chatId);
                break;
            case 'cvemap':
                handleCvemap(chatId);
                break;
            case 'nmap':
                sendNmapOptions(chatId);
                break;
            default:
                if (data.startsWith('nmap_')) {
                    handleNmapScan(chatId, data.split('_')[1]);
                } else {
                    bot.sendMessage(chatId, 'Invalid option selected.');
                }
        }
    } catch (error) {
        console.error("Error handling callback query:", error);
        bot.sendMessage(chatId, 'An error occurred while processing your request.');
    }
}

async function handleGoLinkFinder(chatId) {
    bot.sendMessage(chatId, 'Enter a URL:');
    bot.once('message', async (msg) => {
        const url = msg.text;
        try {
            const { stdout } = await exec(`goLinkFinder -d ${url}`);
            bot.sendMessage(chatId, stdout || 'No endpoints found.');
        } catch (error) {
            bot.sendMessage(chatId, 'Error executing GoLinkFinder. Please check the URL and ensure GoLinkFinder is installed.');
        }
    });
}
async function handleCvemap(chatId) {
    bot.sendMessage(chatId, 'Enter a CVE ID, CWE ID, Vendor, or Product:');
    bot.once('message', async (msg) => {
        const query = msg.text;
        try {
            const { stdout } = await exec(`cvemap -id ${query}`);
            const aiResponse = await openai.createCompletion({
                model: "text-davinci-003",
                prompt: `Summarize the following CVE information and provide potential security risks:\n\n${stdout}`,
                max_tokens: 200,
                temperature: 0.5,
            });
            bot.sendMessage(chatId, aiResponse.data.choices[0].text || 'No relevant CVE information found.');
        } catch (error) {
            console.error(error);
            bot.sendMessage(chatId, 'Error executing CVEMap or processing AI response. Please check the query and ensure CVEMap is installed.');
        }
    });
}

async function sendNmapOptions(chatId) {
    const keyboard = {
        inline_keyboard: scanOptions.map((option) => [{ text: option[0], callback_data: `nmap_${option[1]}` }]),
    };
    bot.sendMessage(chatId, 'Choose an Nmap scan type:', { reply_markup: keyboard });
}

async function handleNmapScan(chatId, nmapArgs) {
    if (nmapArgs === 'custom') {
        bot.sendMessage(chatId, 'Enter custom Nmap arguments:');
        bot.once('message', async (msg) => {
            const customArgs = msg.text;
            await executeNmapScan(chatId, customArgs);
        });
    } else {
        bot.sendMessage(chatId, 'Enter target IP or hostname:');
        bot.once('message', async (msg) => {
            const target = msg.text;
            await executeNmapScan(chatId, nmapArgs, target);
        });
    }
}

async function executeNmapScan(chatId, nmapArgs, target = '') {
    try {
        const command = `nmap ${nmapArgs} ${target}`;
        const { stdout } = await exec(command);
        const aiResponse = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: `Summarize the following Nmap scan results and highlight potential vulnerabilities:\n\n${stdout}`,
            max_tokens: 300,
            temperature: 0.5,
        });
        bot.sendMessage(chatId, aiResponse.data.choices[0].text);
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, 'Error executing Nmap or processing AI response. Please check the target and Nmap arguments.');
    }
}

