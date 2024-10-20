if (process.env.NODE_ENV !== 'production'){
    require('dotenv').config();
}

const { createAuthenticatedClient, OpenPaymentsClientError } = require('@interledger/open-payments');
const readline = require('readline');
const cron = require('node-cron');
const PoolFund = require('./models/pool_funds');
const User = require('./models/user');
const mongoose = require('mongoose')



mongoose.connect('mongodb://localhost:27017/stokvel', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

/*const walletInfo = async () => {
    const client = await createAuthenticatedClient({
        keyId: process.env.KEY_ID,
        privateKey: process.env.PRIVATE_KEY,
        walletAddressUrl: process.env.WALLET_ADDRESS
    });

    const stokvelFund = await client.walletAddress.get({ url: 'https://interledger-test.dev/sindi' });
    console.log(stokvelFund)
}

walletInfo();*/
/*const wallets = async () => {
    const pools = await PoolFund.find({});
    console.log(pools)
}
wallets();*/
const walletUrls = ['https://ilp.interledger-test.dev/sindi', 'https://ilp.interledger-test.dev/thandi', 'https://ilp.interledger-test.dev/thuli', 'https://ilp.interledger-test.dev/thando'];
const poolFundUrl = 'https://ilp.interledger-test.dev/poolfund';


cron.schedule('*/5 * * * *', () => {
    (async (walletUrls, poolFundUrl) => {
        // Create authenticated client
        const client = await createAuthenticatedClient({
            keyId: process.env.KEY_ID,
            privateKey: process.env.PRIVATE_KEY,
            walletAddressUrl: process.env.WALLET_ADDRESS
        });

        // Map through the array of wallet URLs to get wallet information for members
        const wallets = await Promise.all(walletUrls.map(async (url, index) => {
            const wallet = await client.walletAddress.get({ url });
            return {
                walletResourceServer: wallet.resourceServer,
                walletId: wallet.id,
                name: `Member${index + 1}`,  // Customize the name as needed
                authServer: wallet.authServer
            };
        }));

        // Get the pool fund wallet information
        const stokvelFund = await client.walletAddress.get({ url: poolFundUrl });

        // Grant request for pool fund (stokvelFund)
        const incomingPaymentGrant = await client.grant.request(
            {
                url: stokvelFund.authServer,
            },
            {
                access_token: {
                    access: [
                        {
                            type: "incoming-payment",
                            actions: ["create"],
                        },
                    ],
                },
            },
        );

        // Create Incoming Request for pool fund (stokvelFund)
        const incomingPayment = await client.incomingPayment.create(
            {
                url: stokvelFund.resourceServer, // URL of the receiving wallet
                accessToken: incomingPaymentGrant.access_token.value,
            },
            {
                walletAddress: stokvelFund.id,
                expiresAt: new Date(Date.now() + 60_000 * 3).toISOString(),
            }
        );

        // Array to store the quotes and amounts
        const quotes = [];

        // Track successful payments
        let successfulPayments = 0;

        // Variables to track total debit and receive amounts
        let totalDebitAmount = 0;
        let totalReceiveAmount = 0;

        for (const wallet of wallets) {
            try {
                // Create a quote grant for each member wallet
                const quoteGrant = await client.grant.request(
                    {
                        url: wallet.authServer,
                    },
                    {
                        access_token: {
                            access: [
                                {
                                    type: "quote",
                                    actions: ["create"],
                                },
                            ],
                        },
                    },
                );

                // Create a quote for each member wallet to send funds to the pool fund (stokvelFund)
                const quote = await client.quote.create(
                    {
                        url: wallet.walletResourceServer,
                        accessToken: quoteGrant.access_token.value
                    },
                    {
                        walletAddress: wallet.walletId,
                        receiver: incomingPayment.id,
                        method: 'ilp',
                        receiveAmount: {
                            value: '100',  // You can modify this as needed
                            assetCode: stokvelFund.assetCode,
                            assetScale: stokvelFund.assetScale
                        }
                    }
                );
                quotes.push(quote);

                // Accumulate the total debit and receive amounts
                totalDebitAmount += parseInt(quote.debitAmount.value);
                totalReceiveAmount += parseInt(quote.receiveAmount.value);

                // Making a payment
                const outgoingPaymentGrant = await client.grant.request(
                    {
                        url: wallet.authServer
                    },
                    {
                        access_token: {
                            access: [
                                {
                                    type: 'outgoing-payment',
                                    actions: ['create'],
                                    identifier: wallet.walletId,
                                    limits: {
                                        debitAmount: quote.debitAmount,
                                        receiveAmount: quote.receiveAmount
                                    }
                                }
                            ]
                        },
                        interact: {
                            start: ['redirect']
                        }
                    }
                );
                console.log(outgoingPaymentGrant);

                // Wait for the user to accept the grant
                await new Promise((resolve) => {
                    const rl = readline.createInterface({
                        input: process.stdin,
                        output: process.stdout,
                    });

                    rl.question('Accept grant and Press Enter to continue', () => {
                        rl.close();
                        resolve();
                    });
                });

                // Finalize the outgoing payment grant
                const finalizedOutgoingPaymentGrant = await client.grant.continue(
                    {
                        accessToken: outgoingPaymentGrant.continue.access_token.value,
                        url: outgoingPaymentGrant.continue.uri
                    }
                );

                // Create the outgoing payment
                const outgoingPayment = await client.outgoingPayment.create(
                    {
                        url: wallet.walletResourceServer,
                        accessToken: finalizedOutgoingPaymentGrant.access_token.value
                    },
                    {
                        walletAddress: wallet.walletId,
                        quoteId: quote.id,
                        metadata: { description: 'Stokvel Deposit' }
                    }
                );

                // Track successful payment
                successfulPayments++;
                console.log(`Final Payment grant ${wallet.name}:`, outgoingPayment);
            } catch (e) {
                console.log(`Error fetching grant for ${wallet.name}:`, e.message);
            }
        }

        // If all wallets have made successful payments, initiate a lump sum payout
        if (successfulPayments === walletUrls.length) {
            // Select a random wallet for the payout
            const recipientWallet = wallets[Math.floor(Math.random() * wallets.length)];

            console.log(`Initiating lump sum payout to ${recipientWallet.name}`);

            // Calculate total amount for the payout
            const totalLumpSumDebitAmount = totalDebitAmount * walletUrls.length;
            const totalLumpSumReceiveAmount = totalReceiveAmount * walletUrls.length;

            // Create an outgoing payment grant for the pool fund to the selected wallet
            const lumpSumPaymentGrant = await client.grant.request(
                {
                    url: stokvelFund.authServer
                },
                {
                    access_token: {
                        access: [
                            {
                                type: 'outgoing-payment',
                                actions: ['create'],
                                identifier: stokvelFund.id,
                                limits: {
                                    debitAmount: { value: totalLumpSumDebitAmount.toString(), assetCode: stokvelFund.assetCode, assetScale: stokvelFund.assetScale },
                                    receiveAmount: { value: totalLumpSumReceiveAmount.toString(), assetCode: stokvelFund.assetCode, assetScale: stokvelFund.assetScale }
                                }
                            }
                        ]
                    }
                }
            );

            // Make the outgoing lump sum payment
            const lumpSumPayment = await client.outgoingPayment.create(
                {
                    url: stokvelFund.resourceServer,
                    accessToken: lumpSumPaymentGrant.access_token.value
                },
                {
                    walletAddress: recipientWallet.walletId,
                    quoteId: null,  // No quote needed for a direct payout
                    metadata: { description: 'Lump Sum Payout' }
                }
            );

            console.log(`Lump sum payment sent to ${recipientWallet.name}:`, lumpSumPayment);
        }

    })(walletUrls, poolFundUrl);
});