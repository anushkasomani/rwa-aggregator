import Dinari from '@dinari/api-sdk';
import dotenv from 'dotenv';
dotenv.config();
const client = new Dinari({
    apiKeyID: process.env['DINARI_API_KEY_ID'],
    apiSecretKey: process.env['DINARI_API_SECRET_KEY'],
    environment: 'sandbox',
});
async function main() {
    const stocks = await client.v2.marketData.stocks.list();
    console.log(stocks);
}
// main();
//get live market quote for TSLA
async function getTslaQuote() {
    const stockID = process.env['TSLA_ID'] || '';
    const quote = await client.v2.marketData.stocks.retrieveCurrentQuote(stockID);
    console.log("TSLA current quote is: ");
    console.log(quote);
}
// getTslaQuote()
//get market hours 
async function getMarketHoursData() {
    const marketHours = await client.v2.marketData.retrieveMarketHours();
    console.log("retrieve market hours result is :");
    console.log(marketHours);
    console.log("Market Status ", marketHours.is_market_open);
}
// getMarketHoursData()
//-----------------------------------------------
//create an entity 
async function createEntity(name) {
    const createEntityRes = await client.v2.entities.create({
        name: name
    });
    console.log("entity created: ", createEntityRes);
}
// createEntity("hello")
//-------------------------------------------
async function createKYC() {
    const entityID = process.env['ENTITY_ID'] || "";
    const { embed_url, expiration_dt } = await client.v2.entities.kyc.createManagedCheck(entityID);
    console.log("Send user to:", embed_url);
}
// createKYC()
async function getKYCinfo() {
    const entityID = process.env['ENTITY_ID'] || "";
    const kycInfo = await client.v2.entities.kyc.retrieve(entityID);
    console.log("KYC Status:", kycInfo.status); // PASS, FAIL, PENDING
}
// getKYCinfo()
//-----------------------------------------
//create account for a specific entity
async function createAccount() {
    const entityID = process.env['ENTITY_ID'] || "";
    const account = await client.v2.entities.accounts.create(entityID);
    console.log("account create info: ", account);
}
// createAccount()
//------------------------------------
async function mintSandboxToken() {
    const accountID = process.env['ACCOUNT_ID'] || "";
    const mintTokenRes = await client.v2.accounts.mintSandboxTokens(accountID, {
        chain_id: 'eip155:11155111'
    });
    console.log("mint sandbox token result: ", mintTokenRes);
}
mintSandboxToken();
//-----------------------------
//connect wallet 
async function connectWallet() {
    const accountID = process.env['ACCOUNT_ID'] || "";
    const wallet = await client.v2.accounts.wallet.connectInternal(accountID, {
        chain_id: 'eip155:0',
        wallet_address: '0x56621A8F13446c85d5a028942FFdb4D0F2dD703F',
        is_shared: false // Optional
    });
    console.log("Wallet connected:", wallet);
}
// connectWallet()
//----------------------------------------------------------------------//
async function createLimitBuyOrderTSLA() {
    const accountID = process.env['ACCOUNT_ID'] || "";
    const asset_quantity = 1;
    const limit_price = 307;
    const stock_id = process.env['TSLA_ID'] || "";
    const orderRequest = await client.v2.accounts.orderRequests.createLimitBuy(accountID, {
        asset_quantity,
        limit_price,
        stock_id,
    });
    console.log("OrderRequest created:", orderRequest);
}
createLimitBuyOrderTSLA();
async function getWalletByAccount() {
    const accountID = process.env['ACCOUNT_ID'] || "";
    const getWalletRes = await client.v2.accounts.wallet.get(accountID);
    console.log(getWalletRes);
}
// getWalletByAccount()
//# sourceMappingURL=index.js.map