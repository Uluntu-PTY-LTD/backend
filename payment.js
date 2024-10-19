if (process.env.NODE_ENV !== 'production'){
    require('dotenv').config();
}

const { createAuthenticatedClient, OpenPaymentsClientError } = require('@interledger/open-payments');
const readline = require('readline');


    (async () => {
        //create authenticated client
        const client = await createAuthenticatedClient({
            keyId: process.env.KEY_ID,
            privateKey: process.env.PRIVATE_KEY,
            walletAddressUrl: process.env.WALLET_ADDRESS
        })
        //get stokvel member wallets
        const wendyWallet = await client.walletAddress.get({
            url: 'http://ilp.rafiki.money/bobsavings'
        })
    
        const buntuWallet = await client.walletAddress.get({
            url: 'http://ilp.rafiki.money/johnsavings'
        });
    
        const thaboWallet = await client.walletAddress.get({
            url: 'http://ilp.rafiki.money/sandasavings'
        });
    
        /*const sizweWallet = await client.walletAddress.get({
            url: 'http://ilp.rafiki.money/sizwestokvel'
        });*/
    
        const stokvelFund = await client.walletAddress.get({
            url: 'http://ilp.rafiki.money/stokvelFund'
        });
    
        //Grant request for stokvelFund
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
        //console.log(`Incoming Payment Grant Token`, incomingPaymentGrant);
        //console.log(`Wallet Address Keys`, walletAddressKeys);
        
        //Create Incoming Request for stokvelFund
        const incomingPayment = await client.incomingPayment.create(
            {
                url: stokvelFund.resourceServer, //URL of the receiving wallet
                accessToken: incomingPaymentGrant.access_token.value,
            },
            {
                walletAddress: stokvelFund.id,
                expiresAt: new Date(Date.now() + 60_000 * 60).toISOString(),
            },
        );
        //console.log(`Incoming Payment`, incomingPayment);
    
        //Creating a qoute grant and qoute resource for payers (all 4 of them)
        const wallets = [  //create an array of wallets
            {walletResourceServer: wendyWallet.resourceServer, walletId: wendyWallet.id, name: 'Wendy', authServer: wendyWallet.authServer},
            {walletResourceServer: buntuWallet.resourceServer, walletId: buntuWallet.id, name: 'Buntu', authServer: buntuWallet.authServer},
            {walletResourceServer: thaboWallet.resourceServer, walletId: thaboWallet.id, name: 'Thabo', authServer: thaboWallet.authServer}
            //{walletResourceServer: sizweWallet.resourceServer, walletId: sizweWallet.id, name: 'Sizwe', authServer: sizweWallet.authServer}
        ]
        const quotes = [];
        for (const wallet of wallets){
            try{
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
                            value: '2000',
                            assetCode: stokvelFund.assetCode,
                            assetScale: stokvelFund.assetScale
                        }
                    }
                )
                quotes.push(quote)
    
                //MAking a payment
                //1: Payment Grant from Payer Accounts
                const outgoingPaymentGrant = await client.grant.request(
                    {
                        url: wallet.authServer
                    },
                    {
                        access_token:{
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
                )
                console.log(`Outgoing Payment Grant: `, outgoingPaymentGrant);
                
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
    
                const finalizedOutgoingPaymentGrant = await client.grant.continue(
                    {
                        accessToken: outgoingPaymentGrant.continue.access_token.value,
                        url: outgoingPaymentGrant.continue.uri
                    }
                    
                )
                
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
                )
                console.log(`Final Payment grant ${wallet.name}:`, outgoingPayment)
                
            }
            catch (e){
                console.log(`Error fetching grant for ${wallet.name}:`, e.message)
            }
        }
    })();