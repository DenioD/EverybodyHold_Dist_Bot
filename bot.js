const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = 'Insert you TELEGRAM BOT TOKEN';
const bot = new TelegramBot(token, { polling: true });
const bitqueryApiKey = 'Insert your bitqueryApiKey';

function getCurrentDate() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

async function fetchTopTokenHolders(contractAddress) {
    const currentDate = getCurrentDate();
    const query = {
      query: `{
        EVM(dataset: archive, network: eth) {
          TokenHolders(
            date: "${currentDate}"
            tokenSmartContract: "${contractAddress}"
            limit: { count: 15 }
            orderBy: { descending: Balance_Amount }
          ) {
            Holder {
              Address
            }
            Balance {
              Amount
            }
          }
        }
      }`
    };
    const url = `https://streaming.bitquery.io/graphql?token=YOURBITQUERYKEY`; 
    const headers = {
        'Content-Type': 'application/json',
    };

    try {
        const response = await axios.post(url, JSON.stringify(query), { headers });
        console.log(response.data);

        return response.data.data.EVM.TokenHolders;
    } catch (error) {
        console.error('Error fetching top token holders:', error);
        return [];
    }
}

bot.onText(/\/dist/, async (msg) => {
    const chatId = msg.chat.id;
    const contractAddress = '0x68b36248477277865c64dfc78884ef80577078f3';
    const maxSupply = 100000000000; // Max Supply

    let topHolders = await fetchTopTokenHolders(contractAddress);
    if (!topHolders || topHolders.length === 0) {
        bot.sendMessage(chatId, 'No Data available.');
        return;
    }

   
    const deadHolder = topHolders.find(holder => holder.Holder.Address.endsWith('dead'));
    const deadCoins = deadHolder ? parseFloat(deadHolder.Balance.Amount) : 0;
    const deadPercentage = (deadCoins / maxSupply * 100).toFixed(2);

    const uniswapHolder = topHolders.find(holder => holder.Holder.Address === '0x9e5f2b740e52c239da457109bcced1f2bb40da5b');
    const uniswapCoins = uniswapHolder ? parseFloat(uniswapHolder.Balance.Amount) : 0;
    const uniswapPercentage = (uniswapCoins / maxSupply * 100).toFixed(2);

     // Filter DEAD Wallet and Uniswap
    topHolders = topHolders.filter(holder => holder.Holder.Address !== '0x9e5f2b740e52c239da457109bcced1f2bb40da5b' && !holder.Holder.Address.endsWith('dead')).slice(0, 10);

    let combinedPercentage = 0;

    let message = "<b>Top 10 Token Holders (exkl. Uniswap):</b>\n\n";
    message += topHolders.map((holder, index) => {
        const address = holder.Holder.Address;
        const coins = parseFloat(holder.Balance.Amount).toLocaleString();
        const percentage = (parseFloat(holder.Balance.Amount) / maxSupply * 100).toFixed(2);
        combinedPercentage += parseFloat(percentage); 

        let addressDisplay = `${address.slice(0, 6)}...${address.slice(-4)}`;
        return `${index + 1}. <code>${addressDisplay}</code> - ${percentage}%`;
    }).join('\n');

    message += `\n\n<b>All Top 10 combined:</b> ${combinedPercentage.toFixed(2)}%`;

    if (uniswapHolder) {
        message += `\n\n<b>Uniswap Supply:</b>\n ${uniswapCoins.toLocaleString()} HOLD - ${uniswapPercentage}%`;
    }

    if (deadHolder) {
        message += `\n\n<b>Burned Supply:</b>\n ${deadCoins.toLocaleString()} HOLD - ${deadPercentage}%`;
    }

    bot.sendVideo(chatId, './gif_dot.mp4', {
        caption: message,
        parse_mode: 'HTML'
    }).catch(error => {
        console.error('Error while sending ', error);
    });
});

console.log('Bot started...');