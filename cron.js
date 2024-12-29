const axios = require('axios');
const { MongoClient, ServerApiVersion, Decimal128 } = require('mongodb');
const { execSync } = require('child_process');
require('dotenv').config()

function cronFinances() {
    // This script will run every 10 minutes
    console.log('Running cron task - user\'s finances...');
    
    async function run() {
        
        const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
        const client = new MongoClient(uri);
		await client.connect();
        const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
		const userzyCollection = db.collection("uzytkownicy");
		const funkcjeCollection = db.collection("funkcje");
		const uzycieRepCollection = db.collection("uzycie_reporty");
        
		const { ObjectId } = new require('mongodb');
        
		session.startTransaction();
        try {
            console.log('Connected to database - user\'s finances...');
            let users = await userzyCollection.find({}).toArray();
            let nothingFound = true;

            for(let i = 0; i < users.length; i++) {
                let user = users[i];

                let userId = user._id.toString();
                let financesClearDate = new Date(user.nastepny_reset);
                let currentDate = new Date();
                
                // If it's time to reset user's finances
                if(Date.parse(currentDate) >= Date.parse(financesClearDate)) {

                    nothingFound = false;
                    console.log("Clearing expenses data for user: " + userId);

                    let historyWydal = [
                        {
                            "type": "overall",
                            "amount_spent": user.wydal
                        }
                    ];

                    await userzyCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { wydal: 0 } });

                    if(user.reset_limitu_co === "godzina") {
                        let newDate = new Date();
                        newDate.setHours(newDate.getHours() + 1);
                        await userzyCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { nastepny_reset: newDate } });
                    } else if(user.reset_limitu_co === "dzien") {
                        let newDate = new Date();
                        newDate.setDate(newDate.getDate() + 1);
                        await userzyCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { nastepny_reset: newDate } });
                    } else if(user.reset_limitu_co === "5dni") {
                        let newDate = new Date();
                        newDate.setDate(newDate.getDate() + 5);
                        await userzyCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { nastepny_reset: newDate } });
                    } else if(user.reset_limitu_co === "tydzien") {
                        let newDate = new Date();
                        newDate.setDate(newDate.getDate() + 7);
                        await userzyCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { nastepny_reset: newDate } });
                    } else if(user.reset_limitu_co === "2tyg") {
                        let newDate = new Date();
                        newDate.setDate(newDate.getDate() + 14);
                        await userzyCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { nastepny_reset: newDate } });
                    } else if(user.reset_limitu_co === "miesiac") {
                        let newDate = new Date();
                        newDate.setDate(newDate.getDate() + 30);
                        await userzyCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { nastepny_reset: newDate } });
                    }

                    let funkcje = await funkcjeCollection.find({}).toArray();
                    for(let j = 0; j < funkcje.length; j++) {
                        let funkcja = funkcje[j];
                        let funkcjaId = funkcja._id.toString();

                        if(funkcja.uzytkownicy.filter(u => u.id_usera === userId).length !== 1) {
                            console.error("User not found in function: " + funkcja.nazwa + " (" + funkcjaId + ")");
                            continue;
                        }

                        historyWydal.push({
                            "type": funkcja.nazwa + " (" + funkcjaId + ")",
                            "amount_spent": funkcja.uzytkownicy.filter(u => u.id_usera === userId)[0].wydal
                        });

                        await funkcjeCollection.updateOne({ _id: new ObjectId(funkcjaId), "uzytkownicy.id_usera": userId }, { $set: { "uzytkownicy.$.wydal": 0 } });


                        if(funkcja.modele_ai) {
                            for(let k = 0; k < funkcja.modele_ai.length; k++) {
                                let aiModel = funkcja.modele_ai[k];
                                let aiModelName = aiModel.nazwa_modelu;

                                if(funkcja.modele_ai[0].uzytkownicy.filter(u => u.id_usera === userId).length !== 1) {
                                    console.error("User not found in aiModels for function " + funkcja.nazwa + ": " + aiModelName + " (Function ID: " + funkcjaId + ")");
                                    continue;
                                }

                                historyWydal.push({
                                    "type": funkcja.nazwa + " (" + funkcjaId + ") - " + aiModel.nazwa_modelu,
                                    "amount_spent": funkcja.modele_ai[0].uzytkownicy.filter(u => u.id_usera === userId).wydal
                                });

                                await funkcjeCollection.updateOne({ _id: new ObjectId(funkcjaId) }, { $set: { "modele_ai.$[model].uzytkownicy.$[user].wydal": 0 } }, { arrayFilters: [{ "model.nazwa_modelu": aiModelName }, { "user.id_usera": userId }] });
                            }
                        }

                        if(historyWydal.filter(a => a.type === "overall")[0].amount_spent > 0) {

                            await uzycieRepCollection.insertOne({
                                "id_usera": userId,
                                "data": currentDate,
                                "historia_wydal": historyWydal,
                                "nastepny_reset": financesClearDate
                            });
                        }

                    }
                }
            }

            if(nothingFound) {
                console.log("No users found to reset their finances.");
                await session.endSession();
            }
            
        } catch (e) {
            await session.abortTransaction();
            await client.close();
            throw e;
            
        } finally {
            await session.endSession();
            await client.close();
        }
		
	}
	
	run().catch(console.error);
}

function expiredAccess() {
    // This script will run every 10 minutes
    console.log('Running cron task - user\'s access expiry...');
    
    async function run() {
        
        const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
        const client = new MongoClient(uri);
		await client.connect();
        const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
		const userzyCollection = db.collection("uzytkownicy");
        
		const { ObjectId } = new require('mongodb');
        
		session.startTransaction();
        try {
            console.log('Connected to database - user\'s access expiry...');
            let users = await userzyCollection.find({ zbanowany: false }).toArray();
            let nothingFound = true;

            for(let user of users) {
                let userId = user._id.toString();
                let currentDate = new Date();
                
                if(user.dostep_do && Date.parse(user.dostep_do) < Date.parse(currentDate)) {

                    nothingFound = false;
                    console.log("Revoking user's access to service: " + userId);
                    await userzyCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { zbanowany: true, data_zbanowania: currentDate, powod_zbanowania: "Access expired" } });

                }
            }

            if(nothingFound) {
                console.log("No users found to revoke their access.");
                await session.endSession();
            }
            
        } catch (e) {
            await session.abortTransaction();
            await client.close();
            throw e;
            
        } finally {
            await session.endSession();
            await client.close();
        }
		
	}
	
	run().catch(console.error);
}

module.exports = {
    cronFinances,
    expiredAccess
};