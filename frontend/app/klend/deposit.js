"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.depositUSDT = depositUSDT;
var dotenv = require("dotenv");
var bs58_1 = require("bs58");
var kit_1 = require("@solana/kit");
var web3_js_1 = require("@solana/web3.js");
var klend_sdk_1 = require("@kamino-finance/klend-sdk");
var bn_js_1 = require("bn.js");
// Load environment variables
dotenv.config();
// Constants 
var MAIN_MARKET = new web3_js_1.PublicKey('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');
var USDT_MINT = new web3_js_1.PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
// Configuration
var CONFIG = {
    rpcEndpoint: process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
    secretKey: process.env.SECRET_KEY,
    depositAmount: parseFloat(process.env.DEPOSIT_AMOUNT || '1'),
};
/**
 * Load wallet keypair from environment variable
 */
function loadWallet() {
    if (!CONFIG.secretKey) {
        throw new Error('SECRET_KEY not found in environment variables');
    }
    try {
        // Try to decode as base58 first
        var secretKey = bs58_1.default.decode(CONFIG.secretKey);
        return web3_js_1.Keypair.fromSecretKey(secretKey);
    }
    catch (error) {
        try {
            // If base58 fails, try parsing as JSON array
            var secretKeyArray = JSON.parse(CONFIG.secretKey);
            var secretKey = new Uint8Array(secretKeyArray);
            return web3_js_1.Keypair.fromSecretKey(secretKey);
        }
        catch (jsonError) {
            throw new Error('Invalid SECRET_KEY format. Use base58 string or JSON array of bytes');
        }
    }
}
/**
 * Calculate median slot duration using recent available blocks
 */
function getMedianSlotDurationInMsFromLastEpochs(rpc_1) {
    return __awaiter(this, arguments, void 0, function (rpc, samplesToCheck) {
        var epochInfo, currentSlot, slotTimes, i, slotToCheck, blockTime, error_1, durations, i, slotDiff, timeDiff, avgSlotDuration, mid, median, error_2;
        if (samplesToCheck === void 0) { samplesToCheck = 10; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, , 9]);
                    console.log("\uD83D\uDCCA Calculating slot duration from recent ".concat(samplesToCheck, " available blocks..."));
                    return [4 /*yield*/, rpc.getEpochInfo().send()];
                case 1:
                    epochInfo = _a.sent();
                    currentSlot = Number(epochInfo.absoluteSlot);
                    slotTimes = [];
                    i = 1;
                    _a.label = 2;
                case 2:
                    if (!(i <= samplesToCheck * 3 && slotTimes.length < samplesToCheck)) return [3 /*break*/, 7];
                    slotToCheck = currentSlot - (i * 100);
                    if (slotToCheck <= 0)
                        return [3 /*break*/, 7];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, rpc.getBlockTime(slotToCheck).send()];
                case 4:
                    blockTime = _a.sent();
                    if (blockTime) {
                        slotTimes.push({ slot: slotToCheck, time: blockTime });
                        console.log("\uD83D\uDCC8 Slot ".concat(slotToCheck, ": ").concat(new Date(blockTime * 1000).toISOString()));
                    }
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    return [3 /*break*/, 6];
                case 6:
                    i++;
                    return [3 /*break*/, 2];
                case 7:
                    if (slotTimes.length < 2) {
                        console.warn('⚠️ Not enough block times found, using default 400ms');
                        return [2 /*return*/, 400]; // Default Solana slot time
                    }
                    durations = [];
                    slotTimes.sort(function (a, b) { return a.slot - b.slot; }); // Sort by slot number
                    for (i = 1; i < slotTimes.length; i++) {
                        slotDiff = slotTimes[i].slot - slotTimes[i - 1].slot;
                        timeDiff = (slotTimes[i].time - slotTimes[i - 1].time) * 1000;
                        avgSlotDuration = timeDiff / slotDiff;
                        // Only accept reasonable slot durations (200ms to 1000ms)
                        if (avgSlotDuration >= 200 && avgSlotDuration <= 1000) {
                            durations.push(avgSlotDuration);
                        }
                    }
                    if (durations.length === 0) {
                        console.warn('⚠️ No valid slot durations calculated, using default 400ms');
                        return [2 /*return*/, 400];
                    }
                    // Calculate median
                    durations.sort(function (a, b) { return a - b; });
                    mid = Math.floor(durations.length / 2);
                    median = durations.length % 2 === 0
                        ? (durations[mid - 1] + durations[mid]) / 2
                        : durations[mid];
                    console.log("\u2705 Median slot duration: ".concat(median.toFixed(2), "ms (from ").concat(durations.length, " samples)"));
                    return [2 /*return*/, median];
                case 8:
                    error_2 = _a.sent();
                    console.warn('⚠️ Error calculating slot duration, using default 400ms:', error_2 instanceof Error ? error_2.message : String(error_2));
                    return [2 /*return*/, 400]; // Default fallback
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * Create compatibility wrapper for Kamino SDK
 * The Kamino SDK expects web3.js format, but @solana/kit uses different parameter format
 */
function createKaminoCompatibleRpc(kitRpc, connection) {
    var _a;
    var _this = this;
    return _a = {
            // Convert @solana/kit RPC to format expected by Kamino SDK
            getAccountInfo: function (pubkey, config) { return ({
                send: function () { return __awaiter(_this, void 0, void 0, function () {
                    var error_3;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, connection.getAccountInfo(pubkey, (config === null || config === void 0 ? void 0 : config.commitment) || 'confirmed')];
                            case 1: 
                            // Use web3.js connection directly for compatibility
                            return [2 /*return*/, _a.sent()];
                            case 2:
                                error_3 = _a.sent();
                                console.error('getAccountInfo error:', error_3);
                                throw error_3;
                            case 3: return [2 /*return*/];
                        }
                    });
                }); }
            }); },
            getMultipleAccounts: function (pubkeys, config) { return ({
                send: function () { return __awaiter(_this, void 0, void 0, function () {
                    var result, error_4;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, connection.getMultipleAccountsInfo(pubkeys, (config === null || config === void 0 ? void 0 : config.commitment) || 'confirmed')];
                            case 1:
                                result = _a.sent();
                                return [2 /*return*/, { value: result }];
                            case 2:
                                error_4 = _a.sent();
                                console.error('getMultipleAccounts error:', error_4);
                                throw error_4;
                            case 3: return [2 /*return*/];
                        }
                    });
                }); }
            }); },
            getProgramAccounts: function (programId, config) { return ({
                send: function () { return __awaiter(_this, void 0, void 0, function () {
                    var result, error_5;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, connection.getProgramAccounts(programId, config)];
                            case 1:
                                result = _a.sent();
                                return [2 /*return*/, { value: result }];
                            case 2:
                                error_5 = _a.sent();
                                console.error('getProgramAccounts error:', error_5);
                                throw error_5;
                            case 3: return [2 /*return*/];
                        }
                    });
                }); }
            }); },
            getLatestBlockhash: function (config) { return ({
                send: function () { return __awaiter(_this, void 0, void 0, function () {
                    var result, error_6;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, connection.getLatestBlockhash((config === null || config === void 0 ? void 0 : config.commitment) || 'confirmed')];
                            case 1:
                                result = _a.sent();
                                return [2 /*return*/, { value: result }];
                            case 2:
                                error_6 = _a.sent();
                                console.error('getLatestBlockhash error:', error_6);
                                throw error_6;
                            case 3: return [2 /*return*/];
                        }
                    });
                }); }
            }); },
            getBalance: function (pubkey, config) { return ({
                send: function () { return __awaiter(_this, void 0, void 0, function () {
                    var result, error_7;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, connection.getBalance(pubkey, (config === null || config === void 0 ? void 0 : config.commitment) || 'confirmed')];
                            case 1:
                                result = _a.sent();
                                return [2 /*return*/, { value: result }];
                            case 2:
                                error_7 = _a.sent();
                                console.error('getBalance error:', error_7);
                                throw error_7;
                            case 3: return [2 /*return*/];
                        }
                    });
                }); }
            }); },
            getEpochInfo: function (config) { return ({
                send: function () { return __awaiter(_this, void 0, void 0, function () {
                    var error_8;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, connection.getEpochInfo((config === null || config === void 0 ? void 0 : config.commitment) || 'confirmed')];
                            case 1: return [2 /*return*/, _a.sent()];
                            case 2:
                                error_8 = _a.sent();
                                console.error('getEpochInfo error:', error_8);
                                throw error_8;
                            case 3: return [2 /*return*/];
                        }
                    });
                }); }
            }); },
            getBlockTime: function (slot) { return ({
                send: function () { return __awaiter(_this, void 0, void 0, function () {
                    var error_9;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, connection.getBlockTime(slot)];
                            case 1: return [2 /*return*/, _a.sent()];
                            case 2:
                                error_9 = _a.sent();
                                console.error('getBlockTime error:', error_9);
                                throw error_9;
                            case 3: return [2 /*return*/];
                        }
                    });
                }); }
            }); },
            // Properties that might be accessed directly
            commitment: connection.commitment,
            rpcEndpoint: connection.rpcEndpoint
        },
        // Make sure this behaves like a proper RPC client
        _a[Symbol.toStringTag] = 'KaminoCompatibleRpcClient',
        _a;
}
/**
 * Get connection using compatibility approach
 */
function getConnectionPool() {
    // Create both for different purposes
    var kitRpc = (0, kit_1.createSolanaRpc)(CONFIG.rpcEndpoint);
    var connection = new web3_js_1.Connection(CONFIG.rpcEndpoint, 'confirmed');
    // Create compatibility wrapper for Kamino SDK
    var rpc = createKaminoCompatibleRpc(kitRpc, connection);
    return {
        rpc: rpc,
        kitRpc: kitRpc, // Keep the original @solana/kit RPC for future use
        connection: connection // Keep for transaction sending
    };
}
/**
 * Load reserve data (matching GitHub example pattern)
 */
function loadReserveData(params) {
    return __awaiter(this, void 0, void 0, function () {
        var expectedMainnetMarket, slotDuration, market, marketAccountInfo, reserveError_1, reserves, reserve, availableMints, error_10;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\uD83D\uDD0D Attempting to load market: ".concat(params.marketPubkey.toString()));
                    console.log("\uD83D\uDD27 Using PROGRAM_ID: ".concat(klend_sdk_1.PROGRAM_ID.toString()));
                    expectedMainnetMarket = '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF';
                    if (params.marketPubkey.toString() !== expectedMainnetMarket) {
                        console.warn("\u26A0\uFE0F Using non-standard market address. Expected mainnet: ".concat(expectedMainnetMarket));
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 10, , 11]);
                    return [4 /*yield*/, getMedianSlotDurationInMsFromLastEpochs(params.rpc)];
                case 2:
                    slotDuration = _a.sent();
                    console.log("\u23F1\uFE0F Using slot duration: ".concat(slotDuration, "ms for timeout calculations"));
                    console.log('🏪 Loading Kamino market...');
                    return [4 /*yield*/, klend_sdk_1.KaminoMarket.load(params.rpc, // Use our compatibility wrapper
                        params.marketPubkey, slotDuration, // This was missing! It's required
                        klend_sdk_1.PROGRAM_ID, true // withReserves
                        )];
                case 3:
                    market = _a.sent();
                    if (!!market) return [3 /*break*/, 5];
                    return [4 /*yield*/, params.rpc.getAccountInfo(params.marketPubkey).send()];
                case 4:
                    marketAccountInfo = _a.sent();
                    if (!marketAccountInfo) {
                        throw new Error("\u274C Market account does not exist at address: ".concat(params.marketPubkey.toString(), ". Please verify the market address for mainnet: ").concat(expectedMainnetMarket));
                    }
                    if (marketAccountInfo.owner.toString() !== klend_sdk_1.PROGRAM_ID.toString()) {
                        throw new Error("\u274C Market account owner mismatch. Expected: ".concat(klend_sdk_1.PROGRAM_ID.toString(), ", Found: ").concat(marketAccountInfo.owner.toString()));
                    }
                    throw new Error("\u274C KaminoMarket.load() returned null despite account existing. This may indicate:\n        1. RPC client incompatibility with @solana/kit\n        2. Market data deserialization issue\n        3. Incorrect PROGRAM_ID or market version mismatch\n        \n        Market Address: ".concat(params.marketPubkey.toString(), "\n        Expected Program: ").concat(klend_sdk_1.PROGRAM_ID.toString(), "\n        Account Owner: ").concat(marketAccountInfo.owner.toString(), "\n      "));
                case 5:
                    console.log('✅ Market loaded successfully');
                    console.log('📊 Loading market reserves...');
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, market.loadReserves()];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    reserveError_1 = _a.sent();
                    throw new Error("\u274C Failed to load market reserves: ".concat(reserveError_1 instanceof Error ? reserveError_1.message : String(reserveError_1), ". This may indicate network issues or market state corruption."));
                case 9:
                    reserves = Array.from(market.getReserves().values());
                    console.log("\uD83D\uDD0D Found ".concat(reserves.length, " reserves in market"));
                    if (reserves.length === 0) {
                        throw new Error("\u274C No reserves found in market. Market may be empty or corrupted.");
                    }
                    reserve = reserves.find(function (r) {
                        return r.getLiquidityMint().toString() === params.mintPubkey.toString();
                    });
                    if (!reserve) {
                        availableMints = reserves.map(function (r) { return r.getLiquidityMint().toString(); }).slice(0, 10);
                        throw new Error("\u274C Reserve not found for mint: ".concat(params.mintPubkey.toString(), "\n        \n        Available mints in market (first 10):\n        ").concat(availableMints.map(function (mint, i) { return "  ".concat(i + 1, ". ").concat(mint); }).join('\n'), "\n        \n        Total reserves: ").concat(reserves.length, "\n        \n        Please verify the USDT mint address. Expected mainnet USDT: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"));
                    }
                    console.log("\u2705 Found reserve for ".concat(params.mintPubkey.toString()));
                    return [2 /*return*/, { market: market, reserve: reserve, slotDuration: slotDuration }];
                case 10:
                    error_10 = _a.sent();
                    console.error('❌ Error in loadReserveData:', error_10);
                    throw error_10;
                case 11: return [2 /*return*/];
            }
        });
    });
}
/**
 * Check USDT token balance
 */
function checkUSDTBalance(connection, wallet) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, getAssociatedTokenAddress, getAccount, usdtTokenAccount, accountInfo, balance, error_11;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@solana/spl-token'); })];
                case 1:
                    _a = _b.sent(), getAssociatedTokenAddress = _a.getAssociatedTokenAddress, getAccount = _a.getAccount;
                    return [4 /*yield*/, getAssociatedTokenAddress(USDT_MINT, wallet.publicKey)];
                case 2:
                    usdtTokenAccount = _b.sent();
                    return [4 /*yield*/, getAccount(connection, usdtTokenAccount)];
                case 3:
                    accountInfo = _b.sent();
                    balance = Number(accountInfo.amount) / 1000000;
                    return [2 /*return*/, balance];
                case 4:
                    error_11 = _b.sent();
                    console.log('💵 No USDT token account found or balance is 0');
                    return [2 /*return*/, 0];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Send and confirm transaction (matching GitHub example pattern)
 */
function sendAndConfirmTx(connectionPool, wallet, instructions, signers, additionalSigners, label) {
    return __awaiter(this, void 0, void 0, function () {
        var transaction, allSigners, txHash;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    transaction = new web3_js_1.Transaction();
                    transaction.add.apply(transaction, instructions);
                    allSigners = __spreadArray(__spreadArray([wallet], signers, true), additionalSigners, true);
                    return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connectionPool.connection, // Use the original connection for transaction sending
                        transaction, allSigners, { commitment: 'confirmed' })];
                case 1:
                    txHash = _a.sent();
                    console.log("\u2705 ".concat(label, " transaction confirmed:"), txHash);
                    return [2 /*return*/, txHash];
            }
        });
    });
}
/**
 * Main function to deposit USDT to Kamino - Following GitHub example exactly
 */
function depositUSDT() {
    return __awaiter(this, void 0, void 0, function () {
        var c, wallet, solBalance, usdtBalance, _a, market, usdtReserve, slotDuration, amount, timeoutMs, depositAction, txHash, error_12;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('🚀 Starting USDT deposit to Kamino...');
                    console.log('🔧 Debug: Function started');
                    console.log('🔧 Environment check:', {
                        hasSecretKey: !!CONFIG.secretKey,
                        rpcEndpoint: CONFIG.rpcEndpoint,
                        depositAmount: CONFIG.depositAmount
                    });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 7, , 8]);
                    c = getConnectionPool();
                    wallet = loadWallet();
                    console.log("\u2705 Wallet loaded: ".concat(wallet.publicKey.toString()));
                    return [4 /*yield*/, c.connection.getBalance(wallet.publicKey)];
                case 2:
                    solBalance = _b.sent();
                    console.log("\uD83D\uDCB0 SOL Balance: ".concat((solBalance / 1e9).toFixed(4), " SOL"));
                    if (solBalance < 1e6) { // Less than 0.001 SOL
                        throw new Error('Insufficient SOL balance for transaction fees');
                    }
                    // Check USDT balance
                    console.log('💵 Checking USDT balance...');
                    return [4 /*yield*/, checkUSDTBalance(c.connection, wallet)];
                case 3:
                    usdtBalance = _b.sent();
                    console.log("\uD83D\uDCB0 USDT Balance: ".concat(usdtBalance.toFixed(6), " USDT"));
                    if (usdtBalance < CONFIG.depositAmount) {
                        throw new Error("Insufficient USDT balance. Have: ".concat(usdtBalance, " USDT, Need: ").concat(CONFIG.depositAmount, " USDT"));
                    }
                    console.log('📊 Loading market and reserve data...');
                    return [4 /*yield*/, loadReserveData({
                            rpc: c.rpc,
                            connection: c.connection,
                            marketPubkey: MAIN_MARKET,
                            mintPubkey: USDT_MINT,
                        })];
                case 4:
                    _a = _b.sent(), market = _a.market, usdtReserve = _a.reserve, slotDuration = _a.slotDuration;
                    console.log("\u2705 Found USDT reserve: ".concat(usdtReserve.getLiquidityMint().toString()));
                    amount = new bn_js_1.default(CONFIG.depositAmount * 1000000);
                    console.log("\uD83D\uDCB5 Depositing ".concat(CONFIG.depositAmount, " USDT (").concat(amount.toString(), " base units)"));
                    console.log('🔨 Building deposit transaction...');
                    timeoutMs = Math.max(300000, slotDuration * 100);
                    console.log("\u23F1\uFE0F Using timeout: ".concat(timeoutMs, "ms (based on ").concat(slotDuration, "ms slot duration)"));
                    return [4 /*yield*/, klend_sdk_1.KaminoAction.buildDepositReserveLiquidityTxns(market, amount, usdtReserve.getLiquidityMint(), wallet, new klend_sdk_1.VanillaObligation(klend_sdk_1.PROGRAM_ID), undefined, timeoutMs, true)];
                case 5:
                    depositAction = _b.sent();
                    console.log('depositAction.computeBudgetIxsLabels', depositAction.computeBudgetIxsLabels);
                    console.log('depositAction.setupIxsLabels', depositAction.setupIxsLabels);
                    console.log('depositAction.lendingIxsLabels', depositAction.lendingIxsLabels);
                    console.log('depositAction.cleanupIxsLabels', depositAction.cleanupIxsLabels);
                    console.log('✍️ Signing and sending transaction...');
                    return [4 /*yield*/, sendAndConfirmTx(c, wallet, __spreadArray(__spreadArray(__spreadArray(__spreadArray([], depositAction.computeBudgetIxs, true), depositAction.setupIxs, true), depositAction.lendingIxs, true), depositAction.cleanupIxs, true), [], [], 'deposit')];
                case 6:
                    txHash = _b.sent();
                    console.log('✅ Deposit completed successfully!');
                    console.log("\uD83D\uDD17 Explorer: https://explorer.solana.com/tx/".concat(txHash));
                    console.log("\uD83D\uDCB0 Successfully deposited ".concat(CONFIG.depositAmount, " USDT to Kamino"));
                    return [3 /*break*/, 8];
                case 7:
                    error_12 = _b.sent();
                    console.error('❌ Error during deposit:', error_12);
                    if (error_12 instanceof Error) {
                        if (error_12.message.includes('insufficient funds') || error_12.message.includes('insufficient lamports')) {
                            console.error('💡 Make sure you have enough USDT and SOL in your wallet');
                        }
                        else if (error_12.message.includes('SECRET_KEY')) {
                            console.error('💡 Check your .env file and SECRET_KEY format');
                        }
                    }
                    process.exit(1);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
// Run the script (matching GitHub example pattern)
console.log('🔧 Script starting...');
(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('🔧 Async wrapper started');
                return [4 /*yield*/, depositUSDT()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); })().catch(function (e) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.error('🔧 Top-level error caught:', e);
        return [2 /*return*/];
    });
}); });
