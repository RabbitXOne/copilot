const axios = require('axios');
const pptxgen = require("pptxgenjs");
const { MongoClient, ServerApiVersion, Decimal128 } = require('mongodb');
const { execSync } = require('child_process');
const { start } = require('repl');
const { env, send } = require('process');
const {
	GoogleGenerativeAI,
	HarmCategory,
	HarmBlockThreshold,
  } = require("@google/generative-ai");
const {Storage} = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const { jsonrepair } = require('jsonrepair');
// const pptx = require('nodejs-pptx/lib/pptx');
// const { send } = require('process');
require('dotenv').config()

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'gcs-access.json');

const credentials = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
if (!credentials || typeof credentials !== 'object') {
	throw new Error('Invalid Google Cloud credentials JSON');
}

function znajdzTemat(socket, przedmiotId, wyszukiwanie) {

	// TUTAJ KONIECZNIE DODAĆ CHECKI!!

	const MiniSearch = require('minisearch');
	let sendHtml = "";

	const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
	const client = new MongoClient(uri);

	async function connectToDb() {
		try {
			await client.connect();
			let tematy = await client.db("szkolny-copilot").collection("tematy").find({ id_przedmiotu: przedmiotId, ukryty: false }).toArray();
			
			tematy = tematy.map(temat => {
				if (temat._id) {
				  temat.id = temat._id;
				  delete temat._id;
				}
				return temat;
			});

			let miniSearch = new MiniSearch({
				fields: ['tytul_tematu', 'tresc', 'strona_start', 'strona_koniec'],
				storeFields: ['id', 'tytul_tematu', 'id_przedmiotu', 'strona_start', 'strona_koniec']
			});

			miniSearch.addAll(tematy);

			let results = miniSearch.search(wyszukiwanie);

			let x = 0;

			let nazwaPrzedmiotuPromises = results.map(async result => {
				try {
					const { ObjectId } = new require('mongodb');
					let nazwaPrzedmiotu = await client.db("szkolny-copilot").collection("przedmioty").findOne({ _id: new ObjectId(result.id_przedmiotu) });
					
					if(!isNaN(result.strona_start)) {
						result.strona_start = "str. " + result.strona_start;
					}

					if (x === 0) {
						x++;
						return `<div class="selectBookButton w-full rounded-tl-md rounded-tr-md border-b border-gray-200 dark:border-gray-700 p-2 min-h-fit cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-750" onclick="selectBook(event)"><p class="flex-grow text-sm font-light text-gray-900 dark:text-gray-400 whitespace-nowrap overflow-hidden overflow-ellipsis bs--tytultematu">${result.tytul_tematu}</p><div class="flex"><p class="flex-grow text-sm font-light text-gray-600 dark:text-gray-500 whitespace-nowrap overflow-hidden overflow-ellipsis bs--nazwaprzedmiotu">${nazwaPrzedmiotu.przedmiot}</p><p class="text-sm font-light text-gray-600 dark:text-gray-500 flex-end text-end whitespace-nowrap overflow-hidden overflow-ellipsis bs--strona">${result.strona_start}</p><span class="hidden bs--idtematu">${result.id}</span></div></div>`;
					} else {
						x++;
						return `<div class="selectBookButton w-full border-b border-gray-200 dark:border-gray-700 p-2 min-h-fit cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-750" onclick="selectBook(event)"><p class="flex-grow text-sm font-light text-gray-900 dark:text-gray-400 whitespace-nowrap overflow-hidden overflow-ellipsis bs--tytultematu">${result.tytul_tematu}</p><div class="flex"><p class="flex-grow text-sm font-light text-gray-600 dark:text-gray-500 whitespace-nowrap overflow-hidden overflow-ellipsis bs--nazwaprzedmiotu">${nazwaPrzedmiotu.przedmiot}</p><p class="text-sm font-light text-gray-600 dark:text-gray-500 flex-end text-end whitespace-nowrap overflow-hidden overflow-ellipsis bs--strona">${result.strona_start}</p><span class="hidden bs--idtematu">${result.id}</span></div></div>`;
					}

				} catch (e) {
					console.error(e);
					socket.emit('nicNieZnaleziono')

					let errDisplayContent = {
						"userMessage": "Połączenie z bazą danych zostało przerwane.",
						"errorCode": "ERR_DB_EXCEPTION",
						"task": "TASK_SEARCH_TOPIC_MAP",
						"showBox": true,
						"hideAfter": 10000,
						"autoReport": true,
						"takeAction": "none",
						"actionTimeout": 0
					};

					socket.emit('errDisplay', errDisplayContent);
					return;
				}
			});

			let htmlFragments = await Promise.all(nazwaPrzedmiotuPromises);
			sendHtml = htmlFragments.join('');

			if (sendHtml === "") {
				socket.emit('nicNieZnaleziono');
			} else {
				socket.emit('wyszukanoTematy', sendHtml);
			}

		} catch (e) {
			console.error(e);
			socket.emit('nicNieZnaleziono')

			let errDisplayContent = {
				"userMessage": "Połączenie z bazą danych zostało przerwane.",
				"errorCode": "ERR_DB_EXCEPTION",
				"task": "TASK_SEARCH_TOPIC",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": true,
				"takeAction": "none",
				"actionTimeout": 0
			};
			socket.emit('errDisplay', errDisplayContent);

		} finally {
			await client.close();
		}
	}

	connectToDb().catch(console.error);
}

function przedmiotyDropdown (socket, forFunction) {

	// TUTAJ TEŻ CHECKI!!

	let sendHtml = "";

	const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
	const client = new MongoClient(uri);

	async function connectToDb() {
		try {
			await client.connect();

			let przedmioty = null;

			if(forFunction === "generator_testow") {
				przedmioty = await client.db("szkolny-copilot").collection("przedmioty").find({ generator_testow: true, klasa: socket.handshake.session.klasa, szkola: socket.handshake.session.szkola }).toArray();
			} else if(forFunction === "prezentacje") {
				przedmioty = await client.db("szkolny-copilot").collection("przedmioty").find({ prezentacje: true, klasa: socket.handshake.session.klasa, szkola: socket.handshake.session.szkola }).toArray();
			} else {
				przedmioty = await client.db("szkolny-copilot").collection("przedmioty").find({ chat: true, klasa: socket.handshake.session.klasa, szkola: socket.handshake.session.szkola }).toArray();
			}

			// Jeśli nie ma żadnych przedmiotów w bazie danych LUB undefined to zwróć błąd
			if(przedmioty.length === 0 || przedmioty === undefined) {
				sendHtml = '<span class="py-3">Nie znaleziono żadnych przedmiotów :(</span>';
				socket.emit('przedmiotyDropdown', sendHtml);
				return;
			} else {
				przedmioty.forEach(przedmiot => sendHtml = sendHtml + '<li><a href="#" class="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600">' + przedmiot.przedmiot + '</a><span class="hidden">' + przedmiot._id + '</span></li>');
			}

			socket.emit('przedmiotyDropdown', sendHtml);
		
		} catch (e) {
			console.error(e);
			let errDisplayContent = {
				"userMessage": "Połączenie z bazą danych zostało przerwane.",
				"errorCode": "ERR_DB_EXCEPTION",
				"task": "TASK_SEARCH_SUBJECT",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": false,
				"takeAction": "none",
				"actionTimeout": 0
			};
			socket.emit('errDisplay', errDisplayContent);
		} finally {
			// Close the connection to MongoDB
			await client.close();
		}
	}

	connectToDb().catch(console.error);

}

function startChat(socket, wybranyPrzedmiotId, startNewChat) {

	console.log(startNewChat);

	async function run() {
		let userId = socket.handshake.session.userId;
		let sessionId = socket.handshake.session.sessionId;
		if(!userId) {
			let errDisplayContent = {
				"userMessage": "Nie znaleziono sesji. Zaloguj się.",
				"errorCode": "ERR_NOTFOUND_SESSION",
				"task": "TASK_STARTCHAT_VERYFYUSERID",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": false,
				"takeAction": "redirect-logout",
				"actionTimeout": 4000
			};
			socket.emit('errDisplay', errDisplayContent);
		}
	
		const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
		const client = new MongoClient(uri);
		
		await client.connect();
        const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
		const tematyCollection = db.collection("tematy");
		const userzyCollection = db.collection("uzytkownicy");
		const funkcjeCollection = db.collection("funkcje");
		const czatyCollection = db.collection("czaty");
		const przedmiotyCollection = db.collection("przedmioty");
		const configCollection = db.collection("config");
		const sesjeCollection = db.collection("sesje");

		const { ObjectId } = new require('mongodb');

		session.startTransaction();
		try {
			
			let sesjaInfo = await sesjeCollection.find({ _id: new ObjectId(sessionId) }).toArray({ session });
			if(sesjaInfo.length !== 1 || sesjaInfo === undefined || sesjaInfo[0].ended === true) {
				let errDisplayContent = {
					"userMessage": "Sesja została unieważniona lub jest nieprawidłowa. Zaloguj się ponownie.",
					"errorCode": "ERR_INVALID_SESSION",
					"task": "TASK_STARTCHAT_SESSIONVERIFY",
					"showBox": false,
					"hideAfter": 0,
					"autoReport": false,
					"takeAction": "redirect-logout",
					"actionTimeout": 0
				};
				socket.emit('errDisplay', errDisplayContent);
				return;
			}

			let przedmiotInfo = await przedmiotyCollection.find({ _id: new ObjectId(wybranyPrzedmiotId) }).toArray({ session });
			if(przedmiotInfo.length !== 1 || przedmiotInfo === undefined) {
				let errDisplayContent = {
					"userMessage": "Nie znaleziono żądanego elementu.",
					"errorCode": "ERR_NOTFOUND_SUBJECT",
					"task": "TASK_STARTCHAT_GETSUBJECT",
					"showBox": true,
					"hideAfter": 10000,
					"autoReport": true,
					"takeAction": "none",
					"actionTimeout": 0
				};
				socket.emit('errDisplay', errDisplayContent);
				return;
			}

			let chatId = null;
			let setChatboxHtml = "";
			let chatTitle = null;

			let isOldChat = false;

			let previousChat = await czatyCollection.find({ "id_usera": userId, "id_przedmiotu": wybranyPrzedmiotId }).sort({ "data_utworzenia": -1 }).limit(1).toArray({ session });
			if(previousChat.length !== 1 || startNewChat === true) {
				const chatInfo = await czatyCollection.insertOne({ "id_usera": userId, "tytul_czatu": "", "data_utworzenia": new Date(), "ostatnia_aktywnosc": new Date(), "id_przedmiotu": wybranyPrzedmiotId, "wiadomosci": [] });
				chatId = chatInfo.insertedId;
				
				await funkcjeCollection.updateOne(
					{ nazwa: "chat", "uzytkownicy.id_usera": userId },
					{ $set: { "uzytkownicy.$.id_ostatniego_czatu": chatInfo.insertedId } },
					{ session }
				);

			} else {

				// Sprawdź, czy poprzedni czat zawiera jakiekolwiek wiadomości
				if(previousChat[0].wiadomosci.length === 0) {
					// Usuń poprzedni czat
					await czatyCollection.deleteOne({ _id: previousChat[0]._id }, { session });

					// ...i utwórz nowy
					const chatInfo = await czatyCollection.insertOne({ "id_usera": userId, "tytul_czatu": "", "data_utworzenia": new Date(), "ostatnia_aktywnosc": new Date(), "id_przedmiotu": wybranyPrzedmiotId, "wiadomosci": [] });
					chatId = chatInfo.insertedId;

					await funkcjeCollection.updateOne(
						{ nazwa: "chat", "uzytkownicy.id_usera": userId },
						{ $set: { "uzytkownicy.$.id_ostatniego_czatu": chatInfo.insertedId } },
						{ session }
					);
				} else {
					
					// Sprawdź, czy ostatnia aktywność była w ciągu ostatnich 24 godzin
					let lastActivity = new Date(previousChat[0].ostatnia_aktywnosc);
					let now = new Date();
					let diff = Math.abs(now - lastActivity);
					let diffHours = Math.ceil(diff / (1000 * 60 * 60));
	
					let configInfo = await configCollection.find({ name: "max_godz_otworz_poprzedni_czat" }).toArray({ session });
					if(configInfo.length !== 1 || configInfo === undefined) {
						let errDisplayContent = {
							"userMessage": "Połączenie z bazą danych nie powiodło się. Spróbuj ponownie później.",
							"errorCode": "ERR_NOTFFOUND_CONFIG",
							"task": "TASK_STARTCHAT_LOADPREVIOUSCHECK",
							"showBox": true,
							"hideAfter": 10000,
							"autoReport": true,
							"takeAction": "none",
							"actionTimeout": 0
						};
						socket.emit('errDisplay', errDisplayContent);
						return;
					}
	
					if(diffHours > configInfo[0].value) {
						const chatInfo = await czatyCollection.insertOne({ "id_usera": userId, "tytul_czatu": "",  "data_utworzenia": new Date(), "ostatnia_aktywnosc": new Date(), "id_przedmiotu": wybranyPrzedmiotId, "wiadomosci": [] });
						chatId = chatInfo.insertedId;
						await funkcjeCollection.updateOne(
							{ nazwa: "chat", "uzytkownicy.id_usera": userId },
							{ $set: { "uzytkownicy.$.id_ostatniego_czatu": chatInfo.insertedId } },
							{ session }
						);
					} else {
						// Załaduj poprzedni czat
						chatId = previousChat[0]._id;
						isOldChat = true;
						chatTitle = previousChat[0].tytul_czatu;
	
						let messageHistory = previousChat[0].wiadomosci;
	
						for (let message of messageHistory) {
							if (message.role === "user") {
								if(message.sourceId && message.sourceInfo) {
									
									setChatboxHtml = setChatboxHtml + '<div class="rounded bg-orange-500 dark:bg-violet-700 w-4/5 max-w-fit h-fit p-2 m-2 self-end shadow-md"><p class="text-xs font-extralight text-white dark:text-gray-200 text-end select-none"><i class="fa-solid fa-book mr-1"></i>W oparciu o: <span>' + message.sourceInfo[0].tytul_tematu + ', str. ' + message.sourceInfo[0].strona + '</span></p><p class="text-sm font-light text-white text-end">' + message.parts[0].text + "</p></div>";
								} else {
									setChatboxHtml = setChatboxHtml + '<div class="rounded bg-orange-500 dark:bg-violet-700 dark:text-gray-200 w-4/5 max-w-fit h-fit p-2 m-2 self-end shadow-md"><p class="text-sm font-light text-white text-end">' + message.parts[0].text + "</p></div>";
								}
							} else {
								setChatboxHtml = setChatboxHtml + '<div class="rounded dark:bg-gray-800 bg-gray-200 w-4/5 max-w-fit h-fit p-2 m-2 self-start shadow-md"><p class="text-sm font-light text-gray-900 dark:text-white text-start">' + message.parts[0].text + "</p></div>";
							}
						}
					}
				}
			}

			if(chatId === null) {
				let errDisplayContent = {
					"userMessage": "Nie udało się rozpocząć czatu. Przekierowuję na stronę główną...",
					"errorCode": "ERR_DB_INSERT",
					"task": "TASK_STARTCHAT_CREATECHAT",
					"showBox": true,
					"hideAfter": 10000,
					"autoReport": true,
					"takeAction": "redirect-home",
					"actionTimeout": 4000
				};
				socket.emit('errDisplay', errDisplayContent);
				return;
			}

			let supportsRAGBuffer = await przedmiotyCollection.find({ _id: new ObjectId(wybranyPrzedmiotId) }).toArray({ session });
			supportsRAGBuffer = supportsRAGBuffer[0].search_dataset_name;

			let supportsRAG = false;
			if(supportsRAGBuffer !== null && supportsRAGBuffer !== undefined && supportsRAGBuffer !== "" && supportsRAGBuffer !== false) {
				supportsRAG = true;
			}

			if(setChatboxHtml !== "") {
				socket.handshake.session.messageHistory = previousChat[0].wiadomosci;
				socket.emit('startChat', chatId, supportsRAG, isOldChat, setChatboxHtml, chatTitle);
				return;
			}
			
			socket.emit('startChat', chatId, isOldChat, supportsRAG);
			await session.commitTransaction();
		} catch (e) {
			await session.abortTransaction();
			await client.close();
							
			let errDisplayContent = {
				"userMessage": "Połączenie z bazą danych zostało przerwane.",
				"errorCode": "ERR_DB_EXCEPTION",
				"task": "TASK_STARTCHAT",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": true,
				"takeAction": "none",
				"actionTimeout": 0
			};
			socket.emit('errDisplay', errDisplayContent);
			
			throw e;
			
		} finally {
			await session.endSession();
			await client.close();
		}
		
	}
	
	run().catch(console.error);

}

function updateChatTitle(socket, newTitle, chatId) {

	async function run() {
		let userId = socket.handshake.session.userId;
		let sessionId = socket.handshake.session.sessionId;
		if(!userId) {
			let errDisplayContent = {
				"userMessage": "Nie znaleziono sesji. Zaloguj się.",
				"errorCode": "ERR_NOTFOUND_SESSION",
				"task": "TASK_CHATTITLEUPDATE_SESSIONVERIFY",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": false,
				"takeAction": "redirect-logout",
				"actionTimeout": 5000
			};
			socket.emit('errDisplay', errDisplayContent);
		}
	
		const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
		const client = new MongoClient(uri);
		
		await client.connect();
		const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
		const czatyCollection = db.collection("czaty");
		const sesjeCollection = db.collection("sesje");

		const { ObjectId } = new require('mongodb');

		session.startTransaction();
		try {

			let sesjaInfo = await sesjeCollection.find({ _id: new ObjectId(sessionId) }).toArray({ session });
			if(sesjaInfo.length !== 1 || sesjaInfo === undefined || sesjaInfo[0].ended === true) {
				let errDisplayContent = {
					"userMessage": "Sesja została unieważniona lub jest nieprawidłowa. Zaloguj się ponownie.",
					"errorCode": "ERR_INVALID_SESSION",
					"task": "TASK_STARTCHAT_SESSIONVERIFY",
					"showBox": false,
					"hideAfter": 0,
					"autoReport": false,
					"takeAction": "redirect-logout",
					"actionTimeout": 0
				};
				socket.emit('errDisplay', errDisplayContent);
				return;
			}

			await czatyCollection.updateOne({ _id: new ObjectId(chatId) }, { $set: { tytul_czatu: newTitle, ostatnia_aktywnosc: new Date() } });		
			await session.commitTransaction();

		} catch (e) {
			await session.abortTransaction();	
			await client.close();
			let errDisplayContent = {
				"userMessage": "Połączenie z bazą danych zostało przerwane.",
				"errorCode": "ERR_DB_EXCEPTION",
				"task": "TASK_CHATTITLEUPDATE",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": true,
				"takeAction": "none",
				"actionTimeout": 0
			};	
			socket.emit('errDisplay', errDisplayContent);
			throw e;
			
		} finally {
			await session.endSession();
			await client.close();
		}
		
	}
	
	run().catch(console.error);

}

function aiModelDropdown (socket, funkcja) {

	// TUTAJ TEŻ CHECKI!!

	let sendHtml = "";

	const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
	const client = new MongoClient(uri);

	async function connectToDb() {
		try {
			await client.connect();

			if(funkcja === "generator_testow") {
				let functionInfo = await client.db("szkolny-copilot").collection("funkcje").find({ nazwa: "generator_testow" }).toArray();
				functionInfo[0].modele_ai.filter(model => model.uzytkownicy.filter(user => user.id_usera === socket.handshake.session.userId)[0].ma_dostep).forEach(model => sendHtml = sendHtml + '<li><a href="#" class="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600">' + model.nazwa_wyswietlana + '</a><span class="hidden">' + model.nazwa_modelu + '</span></li>');
			} else if(funkcja === "prezentacje") {
				let functionInfo = await client.db("szkolny-copilot").collection("funkcje").find({ nazwa: "prezentacje" }).toArray();
				functionInfo[0].modele_ai.filter(model => model.uzytkownicy.filter(user => user.id_usera === socket.handshake.session.userId)[0].ma_dostep).forEach(model => sendHtml = sendHtml + '<li><a href="#" class="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600">' + model.nazwa_wyswietlana + '</a><span class="hidden">' + model.nazwa_modelu + '</span></li>');
			} else {
				// !functionInfo[0].uzytkownicy.filter(user => user.id_usera === userId)[0].ma_dostep
				let functionInfo = await client.db("szkolny-copilot").collection("funkcje").find({ nazwa: "chat" }).toArray();
				functionInfo[0].modele_ai.filter(model => model.uzytkownicy.filter(user => user.id_usera === socket.handshake.session.userId)[0].ma_dostep).forEach(model => sendHtml = sendHtml + '<li><a href="#" class="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600">' + model.nazwa_wyswietlana + '</a><span class="hidden">' + model.nazwa_modelu + '</span></li>');
			}

			// Jeśli nie ma żadnych przedmiotów w bazie danych LUB undefined to zwróć błąd
			if(sendHtml === "") {
				sendHtml = '<span class="py-3">Nie znaleziono żadnych modeli AI :(</span>';
				socket.emit('aiModelDropdown', sendHtml);
				// socket.emit('requestError', 'Nie znaleziono żadnych modeli AI.');
				return;
			}

			socket.emit('aiModelDropdown', sendHtml);
		
		} catch (e) {
			console.error(e);
			let errDisplayContent = {
				"userMessage": "Połączenie z bazą danych zostało przerwane.",
				"errorCode": "ERR_DB_EXCEPTION",
				"task": "TASK_SEARCH_AIMODEL",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": false,
				"takeAction": "none",
				"actionTimeout": 0
			};
			socket.emit('errDisplay', errDisplayContent);
		} finally {
			// Close the connection to MongoDB
			await client.close();
		}
	}

	connectToDb().catch(console.error);

}

function handleAiRequest(socket, userMsg, selectedSubjectId, selectedTopicId, aiModel, chatId) {

	// Google Gemini

	// socket.emit('requestError', 'Zapytania do API są w tej chwili wyłączone. Spróbuj ponownie później.');
	// return;

	let sessionId = socket.handshake.session.sessionId;
	if(!socket.handshake.session.loggedin || !socket.handshake.session.loggedin === true || !socket.handshake.session.userId || !socket.handshake.session.userId === undefined) {
		socket.emit('requestError', 'Sesja wygasła. Zaloguj się ponownie.');
		return;
	}

	async function run() {
		
		const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
		const client = new MongoClient(uri);

		await client.connect();
        const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
        const tematyCollection = db.collection("tematy");
        const funkcjeCollection = db.collection("funkcje");
        const userzyCollection = db.collection("uzytkownicy");
        const przedmiotyCollection = db.collection("przedmioty");
        const czatyCollection = db.collection("czaty");
        const sesjeCollection = db.collection("sesje");

		const { ObjectId } = new require('mongodb');
		
		session.startTransaction();
		try {

			let sesjaInfo = await sesjeCollection.find({ _id: new ObjectId(sessionId) }).toArray({ session });
			if(sesjaInfo.length !== 1 || sesjaInfo === undefined || sesjaInfo[0].ended === true) {
				let errDisplayContent = {
					"userMessage": "Sesja została unieważniona lub jest nieprawidłowa. Zaloguj się ponownie.",
					"errorCode": "ERR_INVALID_SESSION",
					"task": "TASK_STARTCHAT_SESSIONVERIFY",
					"showBox": false,
					"hideAfter": 0,
					"autoReport": false,
					"takeAction": "redirect-logout",
					"actionTimeout": 0
				};
				socket.emit('errDisplay', errDisplayContent);
				return;
			}

			// Check if the user is not banned, has not exceeded the cost limit, have permissions to the chat feature and has access to the selected AI model
			let userInfo = await userzyCollection.find({ _id: new ObjectId(socket.handshake.session.userId) }).toArray({ session });
			let functionInfo = await funkcjeCollection.find({ nazwa: "chat" }).toArray({ session });
			let userId = socket.handshake.session.userId;

			if(userInfo.length !== 1 || userInfo === undefined || functionInfo.length !== 1 || functionInfo === undefined) {
				socket.emit('requestError', 'Nie udało się pobrać informacji o użytkowniku. Odśwież stronę i spróbuj ponownie.');
				return;
			} else if(userInfo[0].zbanowany === true || !functionInfo[0].uzytkownicy.filter(user => user.id_usera === userId)[0].ma_dostep) {
				socket.emit('requestError', 'To konto nie ma uprawnień do korzystania z tej funkcji.');
				return;
			} else if(!functionInfo[0].modele_ai.filter(model => model.nazwa_modelu === aiModel)[0]) {
				socket.emit('requestError', 'Nie znaleziono wybranego modelu AI.');
				return;
			} else if(!functionInfo[0].modele_ai.filter(model => model.nazwa_modelu === aiModel)[0].uzytkownicy.filter(user => user.id_usera === userId)[0].ma_dostep) {
				socket.emit('requestError', 'Nie masz dostępu do wybranego modelu AI.');
				return;
			} else if(userInfo[0].wydal >= userInfo[0].limit_wydatkow) {
				socket.emit('requestError', 'Osiągnięto limit kosztów w wysokości ' + userInfo[0].limit_wydatkow + 'zł. Zresetowanie limitu nastąpi ' + userInfo[0].nastepny_reset + '.');
				return;
			} else if(functionInfo[0].modele_ai.filter(model => model.nazwa_modelu === aiModel)[0].interfejs_api !== "gemini") {
				socket.emit('requestError', 'Wybrany model AI nie jest dostępny. Aktualnie obsługiwane są wyłącznie modele AI dostępne na platformie Google AI Studio.');
				return;

				// Dodatkowo sprawdź, czy nowe zapytanie nie spowoduje przekroczenia limitu kosztów
			} else if(userInfo[0].wydal + (functionInfo[0].modele_ai.filter(model => model.nazwa_modelu === aiModel)[0].cena_1c_in * userMsg.length) > userInfo[0].limit_wydatkow) {
				socket.emit('requestError', 'Zapytanie zostało odrzucone przez serwer, gdyż spowodowałoby przekroczenie limitu kosztów. Spróbuj ponownie z krótszym promptem.');
			}

			var userMessage = userMsg;
			let userMessageWithText = userMsg;
			socket.handshake.session.messageHistory = socket.handshake.session.messageHistory || [];
			if(selectedTopicId !== null) {

				// Pobierz temat z bazy danych
				let temat = await tematyCollection.find({ _id: new ObjectId(selectedTopicId) }).toArray({ session });

				if(temat.length > 0) {
					userMessageWithText = userMessage + "\n\n\nDo powyższego zapytania został załączony tekst. Oprócz źródeł danych z usługi Vertex AI Search, wykonaj zapytanie w oparciu o poniższy tekst.\n\nJest to " + temat[0].numer_tematu + ". temat w podręczniku, z działu " + temat[0].dzial + ". Tytuł tematu to: " + temat[0].tytul_tematu + ". Ten temat w podręczniku zaczyna się od strony " + temat[0].strona + ". Poniżej znajduje się treść tego tematu. \n\n" + temat[0].tresc;

					socket.handshake.session.messageHistory.push({ "role": "user", "parts": [{ "text": userMessage }, { "text": userMessageWithText }], "sourceId": selectedTopicId, "sourceInfo": [{"dzial": temat[0].dzial, "numer_tematu": temat[0].numer_tematu, "tytul_tematu": temat[0].tytul_tematu, "strona": temat[0].strona, "tresc": temat[0].tresc}] });

				} else {
					socket.emit('requestError', 'Nie udało się pobrać informacji ze źródeł. Odśwież stronę.');
					return;
				}

			} else {
				socket.handshake.session.messageHistory.push({ "role": "user", "parts": [{ "text": userMessage }]});
			}

			// Czy może jednak zrobić tak, że zamiast odczytywać tekst z bazy danych przy każdym zapytaniu to zrobić to tylko raz?
			// socket.handshake.session.messageHistory.push({ "role": "user", "parts": [{ "text": userMessage }, {"text": userMessage + selectedTopicText}], "sourceId": selectedTopicId});
			// Jeśli sourceId istnieje to w message.parts[1].text znajduje się cały prompt, razem z tekstem z bazy danych
		
			var messageHistory = socket.handshake.session.messageHistory;

			// Przed wysłaniem do API wiadomości, należy usunąć wszystkie elementy sourceId oraz inne dodatkowe informacje dodane na potrzeby przetwarzania informacji przez aplikację, jeśli istnieją - BŁĄD: Invalid JSON payload received. Unknown name "sourceId" at 'contents[0]': Cannot find field.

			var messagesToSend = JSON.parse(JSON.stringify(messageHistory));
			
			messagesToSend = messagesToSend.map(msgToMap => {
				if(msgToMap.sourceId && msgToMap.sourceInfo && msgToMap.parts[1]) {
					
					msgToMap.parts[0].text = msgToMap.parts[1].text;
					delete msgToMap.sourceId;
					delete msgToMap.sourceInfo;
					msgToMap.parts.pop();
				}
				
				return msgToMap;
			});

			console.log(messagesToSend);
			await new Promise(resolve => setTimeout(resolve, 4000));

			let systemPrompt = await przedmiotyCollection.find({ _id: new ObjectId(selectedSubjectId) }).toArray({ session });
			systemPrompt = systemPrompt[0].chat_prompt;

			const apiKey = process.env.GEMINI_API_KEY;
			const genAI = new GoogleGenerativeAI(apiKey);

			const model = genAI.getGenerativeModel({
				model: aiModel,
				systemInstruction: systemPrompt,
			});

			const generationConfig = {
				temperature: 0.95,
				topP: 0.95,
				maxOutputTokens: 8192,
				responseMimeType: "text/plain",
			};

			let calyInput = systemPrompt + "\n\n" + userMsg;
			for(let i = 0; i < messagesToSend.length; i++) {
				calyInput = calyInput + "\n\n" + messagesToSend[i].parts[0].text;
			}

			let countResult = await model.countTokens(calyInput);
			let tokenowWyslanych = countResult.totalTokens;

			let cena1tIn = functionInfo[0].modele_ai.filter(modelA => modelA.nazwa_modelu === aiModel)[0].cena_1t_in;
			cena1tIn = parseFloat(cena1tIn);

			let kosztGenerowania = parseFloat((tokenowWyslanych * cena1tIn));

			let aktualnieWydaneUser = parseFloat(userInfo[0].wydal.toString());
			let limitWydatkow = parseFloat(userInfo[0].limit_wydatkow.toString());

			if(aktualnieWydaneUser + kosztGenerowania > limitWydatkow) {
				socket.emit('requestError', 'Przekroczono limit kosztów.');
				return;
			}

			async function run() {
				const chatSession = model.startChat({
				  generationConfig,
					// safetySettings: Adjust safety settings
					// See https://ai.google.dev/gemini-api/docs/safety-settings
				  history: messagesToSend,
				});
			  
				const result = await chatSession.sendMessage(userMessageWithText);
				// console.log(result.response.text());
				return result;
			  }
			  
			let modelAnswerMore = await run();
			let modelAnswer = modelAnswerMore.response.text();
			console.log(modelAnswer);

			console.log(modelAnswerMore);

			// ---
			// Liczenie kosztów

			aktualnieWydaneUser = parseFloat(userInfo[0].wydal.toString());
			let cena1tOut = functionInfo[0].modele_ai.filter(modelA => modelA.nazwa_modelu === aiModel)[0].cena_1t_out;
			cena1tOut = parseFloat(cena1tOut);

			let countResultOut = await model.countTokens(modelAnswer);
			let tokenowOdebranych = countResultOut.totalTokens;

			let kosztOdebranych = parseFloat((tokenowOdebranych * cena1tOut));
			let kosztCalkowity = parseFloat(kosztGenerowania + kosztOdebranych);

			let noweWydane = parseFloat(aktualnieWydaneUser + kosztCalkowity).toString();

			let aktualnieWydaneFunkcja = parseFloat(functionInfo[0].modele_ai.filter(modelA => modelA.nazwa_modelu === aiModel)[0].uzytkownicy.filter(user => user.id_usera === userId)[0].wydal.toString());
			let aktualnieWydaneModel = parseFloat(functionInfo[0].modele_ai.filter(modelA => modelA.nazwa_modelu === aiModel)[0].uzytkownicy.filter(user => user.id_usera === socket.handshake.session.userId)[0].wydal.toString());

			aktualnieWydaneFunkcja = aktualnieWydaneFunkcja + kosztGenerowania + kosztOdebranych;
			aktualnieWydaneFunkcja = aktualnieWydaneFunkcja.toString();
			aktualnieWydaneModel = aktualnieWydaneModel + kosztGenerowania + kosztOdebranych;
			aktualnieWydaneModel = aktualnieWydaneModel.toString();

			await funkcjeCollection.updateOne(
				{ nazwa: "chat", "modele_ai.nazwa_modelu": aiModel, "modele_ai.uzytkownicy.id_usera": socket.handshake.session.userId },
				{ $set: { "modele_ai.$[model].uzytkownicy.$[user].wydal": Decimal128.fromString(aktualnieWydaneFunkcja) } },
				{ arrayFilters: [{ "model.nazwa_modelu": aiModel }, { "user.id_usera": userId }] }
			);

			await funkcjeCollection.updateOne(
				{ nazwa: "chat", "uzytkownicy.id_usera": socket.handshake.session.userId },
				{ $set: { "uzytkownicy.$[user].wydal": Decimal128.fromString(aktualnieWydaneModel) } },
				{ arrayFilters: [{ "user.id_usera": userId }] }
			);

			await userzyCollection.updateOne(
				{ _id: new ObjectId(socket.handshake.session.userId) },
				{ $set: { "wydal": Decimal128.fromString(noweWydane) } },
				{ session }
			);
			
			socket.handshake.session.messageHistory.push({ "role": "model", "parts": [{ "text": modelAnswer }] });
			messageHistory = socket.handshake.session.messageHistory;
			await czatyCollection.updateOne({ _id: new ObjectId(chatId) }, { $set: { ostatnia_aktywnosc: new Date(), wiadomosci: messageHistory } });
	
			socket.emit('successfulRequest', modelAnswer);
			await session.commitTransaction();

		} catch (e) {
			await session.abortTransaction();
			await client.close();

			// Zidentyfikuj czy błąd pochodzi z API czy z bazy danych
			if (e.response) {
				// socket.emit('requestError', 'Błąd API: ' + e.response.data.error.message);
				
				var apiErrorMsg = "BŁĄD: " + e.response.data.error.message;
				if (apiErrorMsg.includes("Quota exceeded for")) {
					apiErrorMsg = "Przekroczono limit zapytań API. Poczekaj chwilę i spróbuj ponownie.";
				} else if(apiErrorMsg.includes("This API method requires billing to be enabled. Please enable billing on project")) {
					apiErrorMsg = "Rozliczenia w tym projekcie Google Cloud Platform nie są włączone. Skontaktuj się z administratorem.";
				}

				socket.emit('requestError', apiErrorMsg);
				
			} else {
				socket.emit('requestError', 'Połączenie z bazą danych nie powiodło się :(');
			}
			
			throw e;

		} finally {
			await session.endSession();
			await client.close();
		}
		
	}

	run().catch(console.error);

}

function saveReport(socket, reportReason, reportOtherText, wybranyPrzedmiotId, IdWybranegoTematu, aiModel) {

	if(!socket.handshake.session.userId || !socket.handshake.session.userId === undefined) {
		socket.emit('sessionNotFound');
		return;
	}

	console.log('Report received')

	const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
	const client = new MongoClient(uri);

	async function connectToDb() {
		try {
			await client.connect();

			let data = {
				"userId": socket.handshake.session.userId,
				"reportReason": reportReason,
				"reportOtherText": reportOtherText,
				"wybranyPrzedmiotId": wybranyPrzedmiotId,
				"IdWybranegoTematu": IdWybranegoTematu,
				"chatHistory": socket.handshake.session.messageHistory,
				"aiModel": aiModel,
				"date": new Date().toISOString(),
				"status": "Oczekuje",
				"adminResponse": "",
			};

			await client.db("szkolny-copilot").collection("reporty").insertOne(data);

			// // Send data to Zapier webhook
			// const zapierWebhook = process.env.ZAPIER_BUGREPORT_WEBHOOK;
			// const axios = require('axios');
			// await axios.post(zapierWebhook, data);

			socket.emit('reportSentSuccessfully');
		} catch (e) {
			console.error(e);
			socket.emit('reportNotSent', 'Nie udało się połączyć z bazą danych :(')
		} finally {
			await client.close();
		}
	}

	connectToDb().catch(console.error);

}

function startup(socket, functionToLoad) {

	async function run() {
		let userId = socket.handshake.session.userId;
		let sessionId = socket.handshake.session.sessionId;
		if(!userId) {
			socket.emit('startup', 'auth-redirection');
		}
	
		const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
		const client = new MongoClient(uri);
		
		await client.connect();
        const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
		const tematyCollection = db.collection("tematy");
		const userzyCollection = db.collection("uzytkownicy");
		const funkcjeCollection = db.collection("funkcje");
		const czatyCollection = db.collection("czaty");
		const sesjeCollection = db.collection("sesje");
		const configCollection = db.collection("config");
		const testyCollection = db.collection("testy");
		const prezentacjeCollection = db.collection("prezentacje");

		const { ObjectId } = new require('mongodb');

		session.startTransaction();
		try {

			let sesjaInfo = await sesjeCollection.find({ _id: new ObjectId(sessionId) }).toArray({ session });
			if(sesjaInfo.length !== 1 || sesjaInfo === undefined || sesjaInfo[0].ended === true) {
				socket.emit('startup', 'auth-redirection');
				return;
			}
			
			let userInfo = await userzyCollection.find({ _id: new ObjectId(userId) }).toArray({ session });
			let przerwaTechniczna = false;

			let przerwaDb = await configCollection.find({ name: "przerwa_techniczna" }).toArray({ session })

			if(przerwaDb[0].value === true || env.MAINTENANCE_MODE === true) przerwaTechniczna = true;

			if(userInfo.length !== 1 || userInfo === undefined) {
				socket.emit('startup', 'auth-redirection');
				return;
			} else if(userInfo[0].zbanowany === true) {
				socket.emit('startup', 'banned');
				return;
			} else if(przerwaTechniczna === true && userInfo[0].uprawnienia !== "admin") {
				socket.emit('startup', 'banned');
				return;
			}
		
			if(functionToLoad === "chat") {

				// if(userInfo[0].wydal > userInfo[0].limit_wydatkow) {
				// 	socket.emit('startup', 'cost-limit-exceeded');
				// 	return;
				// }

				let functionInfo = await funkcjeCollection.find({ nazwa: functionToLoad }).toArray({ session });
				if(functionInfo.length !== 1 || functionInfo === undefined) {
					socket.emit('startup', 'function-not-found');
					return;
				}
				
				if(!functionInfo[0].uzytkownicy.filter(user => user.id_usera === userId)[0].ma_dostep) {
					socket.emit('startup', 'missing-permissions');
					return;
				}

				// Get all AI models user has access to
				let aiModels = functionInfo[0].modele_ai;
				let userModels = aiModels.filter(model => model.uzytkownicy.filter(user => user.id_usera === userId)[0].ma_dostep === true);
	
				if(userModels.length === 0) {
					socket.emit('startup', 'no-aimodels-access');
					return;
				}
	
				// Sort models by priority (lower number = higher priority)
				userModels.sort((a, b) => a.priorytet - b.priorytet);
				var selectedModel = {
					"nazwa_modelu": userModels[0].nazwa_modelu,
					"nazwa_wyswietlana": userModels[0].nazwa_wyswietlana,
				};

				let canUseRAG = functionInfo[0].uzytkownicy.filter(user => user.id_usera === userId)[0].moze_uzywac_rag;
				let canUseInternet = functionInfo[0].uzytkownicy.filter(user => user.id_usera === userId)[0].moze_uzywac_internetu;

				let userFrontendInfo = {
					imie: userInfo[0].imie,
					nazwisko: userInfo[0].nazwisko,
					klasa: userInfo[0].klasa,
					szkola: userInfo[0].szkola,
					uprawnienia: userInfo[0].uprawnienia,
					inicjaly: userInfo[0].imie.charAt(0) + userInfo[0].nazwisko.charAt(0),
					canUseRAG: canUseRAG,
					canUseInternet: canUseInternet
				};

				socket.emit('startup', 'success', selectedModel, userFrontendInfo);
			} else if(functionToLoad === "generator_testow") {

				// if(userInfo[0].wydal > userInfo[0].limit_wydatkow) {
				// 	socket.emit('startup', 'cost-limit-exceeded');
				// 	return;
				// }

				let functionInfo = await funkcjeCollection.find({ nazwa: functionToLoad }).toArray({ session });
				if(functionInfo.length !== 1 || functionInfo === undefined) {
					socket.emit('startup', 'function-not-found');
					return;
				}
				
				if(!functionInfo[0].uzytkownicy.filter(user => user.id_usera === userId)[0].ma_dostep) {
					socket.emit('startup', 'missing-permissions');
					return;
				}

				// Get all AI models user has access to
				let aiModels = functionInfo[0].modele_ai;
				let userModels = aiModels.filter(model => model.uzytkownicy.filter(user => user.id_usera === userId)[0].ma_dostep === true);
	
				if(userModels.length === 0) {
					socket.emit('startup', 'no-aimodels-access');
					return;
				}
	
				// Sort models by priority (lower number = higher priority)
				userModels.sort((a, b) => a.priorytet - b.priorytet);
				var selectedModel = {
					"nazwa_modelu": userModels[0].nazwa_modelu,
					"nazwa_wyswietlana": userModels[0].nazwa_wyswietlana,
				};

				let poprzedniTest = await testyCollection.find({ id_usera: userId, ukonczony: false, }).sort({ data_utworzenia: -1 }).limit(1).toArray({ session });
				if(poprzedniTest.length === 1) {
					let testId = poprzedniTest[0]._id;
					socket.emit('startup', 'success', selectedModel, testId);
					return;
				}

				socket.emit('startup', 'success', selectedModel);
			} else if(functionToLoad === "prezentacje") {

				// if(userInfo[0].wydal > userInfo[0].limit_wydatkow) {
				// 	socket.emit('startup', 'cost-limit-exceeded');
				// 	return;
				// }

				let functionInfo = await funkcjeCollection.find({ nazwa: functionToLoad }).toArray({ session });
				if(functionInfo.length !== 1 || functionInfo === undefined) {
					socket.emit('startup', 'function-not-found');
					return;
				}
				
				if(!functionInfo[0].uzytkownicy.filter(user => user.id_usera === userId)[0].ma_dostep) {
					socket.emit('startup', 'missing-permissions');
					return;
				}

				// Get all AI models user has access to
				let aiModels = functionInfo[0].modele_ai;
				let userModels = aiModels.filter(model => model.uzytkownicy.filter(user => user.id_usera === userId)[0].ma_dostep === true);
	
				if(userModels.length === 0) {
					socket.emit('startup', 'no-aimodels-access');
					return;
				}
	
				// Sort models by priority (lower number = higher priority)
				userModels.sort((a, b) => a.priorytet - b.priorytet);
				var selectedModel = {
					"nazwa_modelu": userModels[0].nazwa_modelu,
					"nazwa_wyswietlana": userModels[0].nazwa_wyswietlana,
				};

				let ostatniePrezentacje = await prezentacjeCollection.find({ id_usera: userId, }).sort({ data_utworzenia: -1 }).limit(3).toArray({ session });
				if(ostatniePrezentacje.length > 0) {
					let prezentacje = [];
					for(let prezentacja of prezentacje) {
						prezentacje.push({
							"id_prezentacji": prezentacja._id,
							"tytul": prezentacja.tytul,
							"nazwa_przedmiotu": prezentacja.nazwa_przedmiotu
						});
					}
					
					socket.emit('startup', 'success', selectedModel, prezentacje);
					return;
				}

				socket.emit('startup', 'success', selectedModel);
			} else if(functionToLoad === "index") {
				// Do zmiennej włóż wszystkie funkcje do których użytkownik ma dostęp.
				// funkcjeCollection, jest wynik a w tym wyniku poza dodatkowymi danymi dot. konkretnej funkcji jest również array z ID użytkowników którzy mają dostęp

				let functionInfo = await funkcjeCollection.find({}).toArray({ session });
				if(functionInfo.length === 0 || functionInfo === undefined) {
					socket.emit('startup', 'db-err');
					return;
				} else {
					functionInfo = functionInfo.filter(functionToFilter => functionToFilter.uzytkownicy.filter(user => user.id_usera === userId)[0].ma_dostep === true);

					let listFunctions = [];
					for(let i = 0; i < functionInfo.length; i++) {
						listFunctions.push({ "nazwa_wyswietlana": functionInfo[i].nazwa_wyswietlana, "fa_ikonka": functionInfo[i].fa_ikonka, "url": functionInfo[i].url });
					}

					let maintenanceModeAccess = false;
					if(przerwaTechniczna === true && userInfo[0].uprawnienia === "admin") {
						maintenanceModeAccess = true;
					}

					// Suma wydatków jest już w userInfo.wydal
					// W progressbarze ma być pokazana informacja o wydanych pieniądzach w stosunku do limitu z podziałem na konkretne usługi
					// Usługi do których użytkownik nie ma dostępu lub pojawia się różnica pomiędzy tym co jest zapisane w userInfo a sumie funkcji, pokazywane są użytkownikowi jako "Inne", o ile różnica ta przekracza 1% limitu

					let limitWydatkow = parseFloat(userInfo[0].limit_wydatkow.toString());
					let wydanoUserDb = parseFloat(userInfo[0].wydal.toString());
					let wydanoFunkcjeSum = 0;
					let wydanoFunkcje = [];
					let wydanoPozostale = 0;

					for(let i = 0; i < functionInfo.length; i++) {

						if(!functionInfo[i].uzytkownicy.filter(user => user.id_usera === userId)[0].wydal) {
							continue;
						}

						if(!functionInfo[i].uzytkownicy.filter(user => user.id_usera === userId)[0].ma_dostep) {
							wydanoPozostale = wydanoPozostale + parseFloat(functionInfo[i].uzytkownicy.filter(user => user.id_usera === userId)[0].wydal.toString());
							return;
						}

						wydanoFunkcjeSum = wydanoFunkcjeSum + parseFloat(functionInfo[i].uzytkownicy.filter(user => user.id_usera === userId)[0].wydal);

						let kolor = "gray-300 dark:gray-700"
						if(i === 0) {
							kolor = "green-500 dark:bg-green-500"
						} else if(i === 1) {
							kolor = "blue-500 dark:bg-blue-500"
						} else if(i === 2) {
							kolor = "yellow-500 dark:bg-yellow-500"
						} else if(i === 3) {
							kolor = "red-500 dark:bg-red-500"
						} else if(i === 4) {
							kolor = "purple-500 dark:bg-purple-500"
						} else if(i === 5) {
							kolor = "pink-500 dark:bg-pink-500"
						} else if(i === 6) {
							kolor = "indigo-500 dark:bg-indigo-500"
						}

						wydanoFunkcje.push({
							"nazwa": functionInfo[i].nazwa,
							"nazwa_wyswietlana": functionInfo[i].nazwa_wyswietlana,
							"wydano": parseFloat(functionInfo[i].uzytkownicy.filter(user => user.id_usera === userId)[0].wydal),
							"procent": parseFloat(functionInfo[i].uzytkownicy.filter(user => user.id_usera === userId)[0].wydal) / limitWydatkow * 100,
							"kolor": kolor
						});
					}

					if(wydanoPozostale > 0) {

						if(wydanoPozostale / limitWydatkow * 100 > 1) {
							wydanoFunkcje.push({
								"nazwa": "inne",
								"nazwa_wyswietlana": "Inne",
								"wydano": wydanoPozostale,
								"procent": wydanoPozostale / limitWydatkow * 100,
								"kolor": "gray-300 dark:gray-700"
							});
						}
					}

					let kiedyReset = new Date(userInfo[0].nastepny_reset);
					// Przekonwertuj datę na format (po polsku): "dzień_tygodnia, dzień_miesiąca miesiąc_słownie rok r. o godzina:minuta"
					let dzienTygodnia = ["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"];
					let miesiacSlownie = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
					let godziny = (kiedyReset.getHours() < 10 ? "0" : "") + kiedyReset.getHours();
					let minuty = (kiedyReset.getMinutes() < 10 ? "0" : "") + kiedyReset.getMinutes();

					kiedyReset = dzienTygodnia[kiedyReset.getDay()] + ", " + kiedyReset.getDate() + " " + miesiacSlownie[kiedyReset.getMonth()] + " " + kiedyReset.getFullYear() + " r. o " + godziny + ":" + minuty;

					let kosztyInfo = {
						"limit": limitWydatkow,
						"wydano": wydanoUserDb,
						"wydanoFunkcje": wydanoFunkcje,
						"reset": kiedyReset,
						"reset_co": userInfo[0].reset_limitu_co
					}

					// Użytkownik od: data w formacie: "dzień_tygodnia, dzień_miesiąca miesiąc_słownie rok"
					let dataPierwszegoLogowania = new Date(userInfo[0].data_pierwszego_logowania);
					let dzienTygodniaLogowania = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
					let miesiacSlownieLogowania = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

					let dataPierwszegoLogowaniaString = dzienTygodniaLogowania[dataPierwszegoLogowania.getDay()] + ", " + dataPierwszegoLogowania.getDate() + " " + miesiacSlownieLogowania[dataPierwszegoLogowania.getMonth()] + " " + dataPierwszegoLogowania.getFullYear();

					let supportInviteLink = await configCollection.findOne({ name: "discord_support_invite_link" }, { session });
					supportInviteLink = supportInviteLink.value;

					let userFrontendInfo = {
						imie: userInfo[0].imie,
						nazwisko: userInfo[0].nazwisko,
						klasa: userInfo[0].klasa,
						szkola: userInfo[0].szkola,
						uprawnienia: userInfo[0].uprawnienia,
						inicjaly: userInfo[0].imie.charAt(0) + userInfo[0].nazwisko.charAt(0),
						maintenanceModeAccess: maintenanceModeAccess,
						koszty: kosztyInfo,
						uzytkownikOd: dataPierwszegoLogowaniaString,
						supportInviteLink: supportInviteLink
					};

					let announcement = await configCollection.find({ name: "ogloszenie" }).toArray({ session });
					if(announcement.length === 0 || announcement === undefined || announcement[0].value === "") {
						// Nie ma ogłoszenia
						socket.emit('startup', 'success', listFunctions, userFrontendInfo)
						return;
					} else {

						let announcementFrontend = {
							tresc: announcement[0].value,
							typ: announcement[0].type,
							ikonka: announcement[0].fa_ikonka
						};

						socket.emit('startup', 'success', listFunctions, userFrontendInfo, announcementFrontend)
						return;
					}

				}

			} else if(functionToLoad === "hasloreset") {

				let userFrontendInfo = {
					imie: userInfo[0].imie,
					nazwisko: userInfo[0].nazwisko,
					klasa: userInfo[0].klasa,
					szkola: userInfo[0].szkola,
					uprawnienia: userInfo[0].uprawnienia,
					inicjaly: userInfo[0].imie.charAt(0) + userInfo[0].nazwisko.charAt(0),
				};

				socket.emit('startup', 'success', userFrontendInfo)
			} else if(functionToLoad === "privacy") {

				let content = await configCollection.findOne({ name: "polityka_prywatnosci" }, { session });
				content = content.value;

				socket.emit('startup', 'success', content)
			
			} else if(functionToLoad === "rozwiazania_zadan") {
				let functionInfo = await funkcjeCollection.find({}).toArray({ session });
				if(functionInfo.length === 0 || functionInfo === undefined) {
					socket.emit('startup', 'db-err');
					return;
				} else {
					let functionInfo = await funkcjeCollection.find({ nazwa: functionToLoad }).toArray({ session });
					if(functionInfo.length !== 1 || functionInfo === undefined) {
						socket.emit('startup', 'function-not-found');
						return;
					}
					
					if(!functionInfo[0].uzytkownicy.filter(user => user.id_usera === userId)[0].ma_dostep) {
						socket.emit('startup', 'missing-permissions');
						return;
					}

					let sendHtml = "";
					let przedmioty = functionInfo[0].przedmioty.filter(przedmiot => przedmiot.klasa === socket.handshake.session.klasa && przedmiot.szkola === socket.handshake.session.szkola && przedmiot.linki.length > 0);

					if(przedmioty.length === 0 || przedmioty === undefined) {
						socket.emit('startup', 'banned');
						return;
					}

					for(let i = 0; i < przedmioty.length; i++) {

						let linkHtml = "";
						for(let j = 0; j < przedmioty[i].linki.length; j++) {
							linkHtml = linkHtml + '<a href="' + przedmioty[i].linki[j].url + '" class="dark:bg-gray-800 hover:dark:bg-gray-750 bg-gray-100 hover:bg-gray-150 transition duration-150 border border-gray-300 dark:border-gray-700 hover:border-2 dark:hover:border-violet-700 hover:border-orange-500 text-gray-900 dark:text-gray-50 px-4 py-2 rounded-md mr-2">' + przedmioty[i].linki[j].nazwa_wyswietlana + '</a>';
						}
						
						sendHtml = sendHtml + '<div class="h-fit relative flex flex-row sm:flex-col sm:w-64 sm:aspect-square bg-gray-50 dark:bg-gray-850 rounded-md m-4 mb-2 cursor-pointer transition duration-200 shadow-md border border-gray-200 dark:border-gray-700 sm:items-center sm:justify-center"><div class="sm:items-center sm:justify-center flex flex-row sm:flex-col hover:bg-gray-100 hover:dark:bg-gray-800 w-full h-full rounded-md transition duration-200 p-4 cursor-pointer" onclick="btnShowSelect(\'#btn-' + i + 'select\')"><i class="' + przedmioty[i].fa_ikonka + ' text-4xl sm:text-8xl text-gray-700 dark:text-gray-300 sm:self-center content-center"></i><p class="sm:text-xl text-2xl font-semibold sm:mt-4 mt-0.5 text-gray-700 dark:text-gray-300 sm:text-center text-start ml-4 sm:ml-0 content-center">' + przedmioty[i].nazwa_wyswietlana + '</p></div><div id="btn-' + i + 'select" class="rounded-md hidden cursor-default absolute inset-0 flex-row flex-wrap justify-center items-center bg-gray-50 dark:bg-gray-850 transition-opacity duration-200">' + linkHtml + '</div></div>';

						// sendHtml = sendHtml + '<p>' + przedmioty[i].nazwa_przedmiotu + '</p>';
					}

					let userFrontendInfo = {
						imie: userInfo[0].imie,
						nazwisko: userInfo[0].nazwisko,
						klasa: userInfo[0].klasa,
						szkola: userInfo[0].szkola,
						uprawnienia: userInfo[0].uprawnienia,
						inicjaly: userInfo[0].imie.charAt(0) + userInfo[0].nazwisko.charAt(0)
					};

					socket.emit('startup', 'success', sendHtml, userFrontendInfo);
				}
				
			}

			await session.commitTransaction();
			
		} catch (e) {
			await session.abortTransaction();
			await client.close();
							
			socket.emit('startup', 'db-err');
			
			throw e;
			
		} finally {
			await session.endSession();
			await client.close();
		}
		
	}
	
	run().catch(console.error);
}

function dzialDropdown (socket, forFunction, przedmiotId) {

	async function run() {
		let userId = socket.handshake.session.userId;
		let sessionId = socket.handshake.session.sessionId;
		if(!userId) {
			socket.emit('startup', 'auth-redirection');
		}
	
		const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
		const client = new MongoClient(uri);
		
		await client.connect();
        const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
		const tematyCollection = db.collection("tematy");
		const przedmiotyCollection = db.collection("przedmioty");
		
		const { ObjectId } = new require('mongodb');

		let sendHtml = "";

		session.startTransaction();
		try {

			let przedmioty = await przedmiotyCollection.find({ _id: new ObjectId(przedmiotId) }).toArray({ session });
			if (przedmioty.length !== 1) {
				socket.emit('dzialDropdown', 'Brak działów do wyboru');
				return;
			}

			let tematy = await tematyCollection.find({ id_przedmiotu: przedmiotId }).toArray({ session });
			if (tematy.length === 0) {
				socket.emit('dzialDropdown', 'Brak działów do wyboru');
				return;
			}

			let dzialy = [];
			for(let i = 0; i < tematy.length; i++) {
				if(dzialy.filter(dzial => dzial.numer_dzialu === tematy[i].dzial).length === 0) {
					dzialy.push({
						// Numer działu, nazwa działu, liczba tematów w dziale
						numer_dzialu: tematy[i].dzial,
						nazwa_dzialu: tematy[i].nazwa_dzialu,
						liczba_tematow: tematy.filter(temat => temat.dzial === tematy[i].dzial).length
					});
				}
			}

			dzialy.forEach(dzial => sendHtml = sendHtml + '<li><a href="#" class="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600">' + dzial.numer_dzialu + '. ' + dzial.nazwa_dzialu + ' (' + dzial.liczba_tematow + ' tematów)</a><span class="hidden">' + dzial.numer_dzialu + '</span></li>');

			socket.emit('dzialDropdown', sendHtml);
			await session.commitTransaction();
			
		} catch (e) {
			await session.abortTransaction();
			await client.close();
							
			let errDisplayContent = {
				"userMessage": "Połączenie z bazą danych zostało przerwane.",
				"errorCode": "ERR_DB_EXCEPTION",
				"task": "TASK_SEARCH_SECTION",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": false,
				"takeAction": "none",
				"actionTimeout": 0
			};
			socket.emit('errDisplay', errDisplayContent);
			
			throw e;
			
		} finally {
			await session.endSession();
			await client.close();
		}
		
	}
	
	run().catch(console.error);

}

function obliczKosztyGenerowaniaTestu(socket, modelAi, przedmiot, dzial) {
	async function run() {
		let userId = socket.handshake.session.userId;
		let sessionId = socket.handshake.session.sessionId;
		if(!userId) {
			socket.emit('startup', 'auth-redirection');
		}
	
		const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
		const client = new MongoClient(uri);
		
		await client.connect();
        const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
		const tematyCollection = db.collection("tematy");
		const przedmiotyCollection = db.collection("przedmioty");
		const funkcjeCollection = db.collection("funkcje");
		
		const { ObjectId } = new require('mongodb');

		session.startTransaction();
		try {

			let promptSystemowy = await przedmiotyCollection.find({ _id: new ObjectId(przedmiot) }).toArray({ session });
			if (promptSystemowy.length !== 1) {
				socket.emit('generujTest', 'failed');
				return;
			}

			promptSystemowy = promptSystemowy[0].testgen_prompt;

			dzial = parseInt(dzial);

			let tematy = await tematyCollection.find({ id_przedmiotu: przedmiot, dzial: dzial }).toArray({ session });
			if (tematy.length === 0) {
				socket.emit('generujTest', 'failed');
				return;
			}

			let calyPrompt = promptSystemowy + "\n";
			for(let i = 0; i < tematy.length; i++) {
				calyPrompt = calyPrompt + tematy[i].tresc + "\n";
				calyPrompt = calyPrompt + tematy[i].zadania + "\n";
				calyPrompt = calyPrompt + tematy[i].tytul_tematu + "\n";
				calyPrompt = calyPrompt + tematy[i].strona_koniec + "\n";
				calyPrompt = calyPrompt + tematy[i].strona_start + "\n";
			}

			const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
			const model = genAI.getGenerativeModel({
				model: modelAi,
			});

			// Count tokens in a prompt without calling text generation.
			const countResult = await model.countTokens(calyPrompt);

			let sumaTokenow = countResult.totalTokens;

			let cena1tIn = await funkcjeCollection.find({ nazwa: "generator_testow" }).toArray({ session });
			if(cena1tIn.length !== 1) {
				socket.emit('generujTest', 'failed');
				return;
			}

			cena1tIn = cena1tIn[0].modele_ai.filter(model => model.nazwa_modelu === modelAi)[0].cena_1t_in;
			cena1tIn = parseFloat(cena1tIn);

			let kosztGenerowania = sumaTokenow * cena1tIn;
			kosztGenerowania = kosztGenerowania.toFixed(2);
			kosztGenerowania = kosztGenerowania.toString().replace(".", ",");

			socket.emit('obliczKosztyGenerowaniaTestu', kosztGenerowania);
			await session.commitTransaction();
			
		} catch (e) {
			await session.abortTransaction();
			await client.close();
							
			let errDisplayContent = {
				"userMessage": "Połączenie z bazą danych zostało przerwane.",
				"errorCode": "ERR_DB_EXCEPTION",
				"task": "TASK_SEARCH_SECTION",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": false,
				"takeAction": "none",
				"actionTimeout": 0
			};
			socket.emit('errDisplay', errDisplayContent);
			console.log('baza danych przerwane polaczenie')
			socket.emit('pptxApi', 'failed', 'Połączenie z bazą danych zostało przerwane.');
			
			throw e;
			
		} finally {
			await session.endSession();
			await client.close();
		}
		
	}
	
	run().catch(console.error);
}

function generujTest(socket, przedmiot, dzial, aiModel) {
	console.log("Generuję test");
	async function run() {
		let userId = socket.handshake.session.userId;
		let sessionId = socket.handshake.session.sessionId;
		if(!userId) {
			socket.emit('startup', 'auth-redirection');
		}
	
		const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
		const client = new MongoClient(uri);
		
		await client.connect();
        const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
		const tematyCollection = db.collection("tematy");
		const przedmiotyCollection = db.collection("przedmioty");
		const funkcjeCollection = db.collection("funkcje");
		const testyCollection = db.collection("testy");
		const userzyCollection = db.collection("uzytkownicy");
		
		const { ObjectId } = new require('mongodb');

		session.startTransaction();
		try {

			let promptSystemowy = await przedmiotyCollection.find({ _id: new ObjectId(przedmiot) }).toArray({ session });
			if (promptSystemowy.length !== 1) {
				socket.emit('startup', 'banned');
				return;
			}

			promptSystemowy = promptSystemowy[0].testgen_prompt;

			dzial = parseInt(dzial);

			let tematy = await tematyCollection.find({ id_przedmiotu: przedmiot, dzial: dzial }).toArray({ session });
			if (tematy.length === 0) {
				socket.emit('startup', 'banned');
				return;
			}

			let calyPrompt = promptSystemowy + "\n";
			for(let i = 0; i < tematy.length; i++) {
				calyPrompt = calyPrompt + tematy[i].tresc + "\n";
				calyPrompt = calyPrompt + tematy[i].zadania + "\n";
				calyPrompt = calyPrompt + tematy[i].tytul_tematu + "\n";
				calyPrompt = calyPrompt + tematy[i].strona_koniec + "\n";
				calyPrompt = calyPrompt + tematy[i].strona_start + "\n";
			}

			const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
			const model = genAI.getGenerativeModel({
				model: aiModel,
				systemInstruction: promptSystemowy,
			});

			let funkcjaInfo = await funkcjeCollection.find({ nazwa: "generator_testow" }).toArray({ session });
			if(funkcjaInfo.length !== 1) {
				socket.emit('startup', 'banned');
				return;
			}

			if(funkcjaInfo[0].modele_ai.filter(model => model.nazwa_modelu === aiModel)[0].uzytkownicy.filter(user => user.id_usera === userId).length !== 1) {
				socket.emit('generujTest', 'failed');
			}

			// ---
			// Sprawdź, czy wygenerowanie nie spowoduje przekroczenia limitu wydatków

			// Count tokens in a prompt without calling text generation.
			const countResult = await model.countTokens(calyPrompt);

			let tokenowWyslanych = countResult.totalTokens;

			let cena1tIn = funkcjaInfo[0].modele_ai.filter(modelA => modelA.nazwa_modelu === aiModel)[0].cena_1t_in;
			cena1tIn = parseFloat(cena1tIn);

			let kosztGenerowania = parseFloat((tokenowWyslanych * cena1tIn));

			let userInfo = await userzyCollection.find({ _id: new ObjectId(socket.handshake.session.userId) }).toArray({ session });
			let aktualnieWydaneUser = parseFloat(userInfo[0].wydal.toString());
			let limitWydatkow = parseFloat(userInfo[0].limit_wydatkow.toString());

			if(aktualnieWydaneUser + kosztGenerowania > limitWydatkow) {
				socket.emit('generujTest', 'failed');
				return;
			}

			// ---

			const generationConfig = {
				temperature: 0.95,
				topP: 0.95,
				topK: 40,
				maxOutputTokens: 8192,
				responseMimeType: "application/json",
				responseSchema: {
					type: "object",
					properties: {
					pytania: {
						type: "array",
						items: {
						type: "object",
						properties: {
							tresc_pytania: {
							type: "string"
							},
							typ_pytania: {
							type: "string"
							},
							odpowiedzi: {
							type: "array",
							items: {
								type: "object",
								properties: {
								tresc_odpowiedzi: {
									type: "string"
								},
								poprawna: {
									type: "boolean"
								}
								},
								required: [
								"tresc_odpowiedzi",
								"poprawna"
								]
							}
							},
							wyjasnienie_poprawna: {
							type: "string"
							},
							wyjasnienie_bledna: {
							type: "string"
							}
						},
						required: [
							"tresc_pytania",
							"typ_pytania",
							"odpowiedzi",
							"wyjasnienie_poprawna",
							"wyjasnienie_bledna"
						]
						}
					}
					},
					required: [
					"pytania"
					]
				},
			};

			async function run() {
				const chatSession = model.startChat({
					generationConfig
				});
				
				const result = await chatSession.sendMessage(calyPrompt);
				// console.log(result.response.text());
				return result;
			}
			
			let modelAnswer = await run();
			let modelAnswerText = modelAnswer.response.text();

			let inputTokensPrompt = await model.countTokens(calyPrompt);
			let outputTokensPrompt = await model.countTokens(modelAnswerText);

			let inputTokens = inputTokensPrompt.totalTokens;
			let outputTokens = outputTokensPrompt.totalTokens;

			if(modelAnswer.response.candidates.finishReason === "MAX_TOKENS") {
				let maxTries = 5;
				let tries = 0;
				let generateMore = true;

				let messageHistory = [
					{
						"role": "user",
						"parts": [
							{
								"text": calyPrompt
							}
						]
					},
					{
						"role": "model",
						"parts": [
							{
								"text": modelAnswerText
							}
						]
					}
				];

				modelAnswerText = jsonrepair(modelAnswerText);
				modelAnswerText = JSON.parse(modelAnswerText);
				
				delete modelAnswerText.pytania[modelAnswerText.pytania.length - 1];
				
				while(generateMore && tries < maxTries) {
					console.log('Generuję więcej');
					tries++;

					async function more() {
						const chatSession = model.startChat({
							generationConfig,
							history: messageHistory,
						});
						
						const result = await chatSession.sendMessage("Kontynuuj");
						return result;
					}
					
					let modelAnswerMore = await more();
					let modelAnswerTextMore = modelAnswerMore.response.text();

					inputTokensPrompt = await model.countTokens(calyPrompt);
					outputTokensPrompt = await model.countTokens(modelAnswerTextMore);

					inputTokens = inputTokens + inputTokensPrompt.totalTokens;
					outputTokens = outputTokens + outputTokensPrompt.totalTokens;
					
					if(modelAnswerMore.response.candidates.finishReason !== "MAX_TOKENS") {
						generateMore = false;
						modelAnswerTextMore = jsonrepair(modelAnswerTextMore);
						modelAnswerTextMore = JSON.parse(modelAnswerTextMore);
						modelAnswerText.pytania = modelAnswerText.pytania.concat(modelAnswerTextMore.pytania);
					} else {
						modelAnswerTextMore = jsonrepair(modelAnswerTextMore);
						modelAnswerTextMore = JSON.parse(modelAnswerTextMore);
						delete modelAnswerTextMore.pytania[modelAnswerTextMore.pytania.length - 1];

						modelAnswerText.pytania = modelAnswerText.pytania.concat(modelAnswerTextMore.pytania);
					}

				}

				if(tries === maxTries) {
					socket.emit('generujTest', 'failed');
					return;
				}
			}

			let cena1tOut = funkcjaInfo[0].modele_ai.filter(modelA => modelA.nazwa_modelu === aiModel)[0].cena_1t_out;
			cena1tOut = parseFloat(cena1tOut);

			let kosztIn = inputTokens * cena1tIn;
			let kosztOut = outputTokens * cena1tOut;

			userInfo = await userzyCollection.find({ _id: new ObjectId(socket.handshake.session.userId) }).toArray({ session });
			aktualnieWydaneUser = parseFloat(userInfo[0].wydal.toString());

			let aktualnieWydaneFunkcja = parseFloat(funkcjaInfo[0].uzytkownicy.filter(user => user.id_usera === socket.handshake.session.userId)[0].wydal.toString());
			let aktualnieWydaneModel = parseFloat(funkcjaInfo[0].modele_ai.filter(modelA => modelA.nazwa_modelu === aiModel)[0].uzytkownicy.filter(user => user.id_usera === socket.handshake.session.userId)[0].wydal.toString());

			aktualnieWydaneUser = aktualnieWydaneUser + kosztIn + kosztOut;
			aktualnieWydaneUser = aktualnieWydaneUser.toString();
			aktualnieWydaneFunkcja = aktualnieWydaneFunkcja + kosztIn + kosztOut;
			aktualnieWydaneFunkcja = aktualnieWydaneFunkcja.toString();
			aktualnieWydaneModel = aktualnieWydaneModel + kosztIn + kosztOut;
			aktualnieWydaneModel = aktualnieWydaneModel.toString();

			await funkcjeCollection.updateOne(
				{ nazwa: "generator_testow", "modele_ai.nazwa_modelu": aiModel, "modele_ai.uzytkownicy.id_usera": socket.handshake.session.userId },
				{ $set: { "modele_ai.$[model].uzytkownicy.$[user].wydal": Decimal128.fromString(aktualnieWydaneFunkcja) } },
				{ arrayFilters: [{ "model.nazwa_modelu": aiModel }, { "user.id_usera": userId }] }
			);

			await funkcjeCollection.updateOne(
				{ nazwa: "generator_testow", "uzytkownicy.id_usera": socket.handshake.session.userId },
				{ $set: { "uzytkownicy.$[user].wydal": Decimal128.fromString(aktualnieWydaneModel) } },
				{ arrayFilters: [{ "user.id_usera": userId }] }
			);

			await userzyCollection.updateOne(
				{ _id: new ObjectId(socket.handshake.session.userId) },
				{ $set: { "wydal": Decimal128.fromString(aktualnieWydaneUser) } },
				{ session }
			);

			let getPrzedmiotFromDb = await przedmiotyCollection.findOne({ _id: new ObjectId(przedmiot) }, { session })
			let nazwa_przedmiotu = getPrzedmiotFromDb.przedmiot;

			let getDzialFromDb = await tematyCollection.find({ id_przedmiotu: przedmiot, dzial: parseInt(dzial) }).toArray({ session });
			let nazwa_dzialu = getDzialFromDb[0].nazwa_dzialu;

			modelAnswerText = jsonrepair(modelAnswerText);
			modelAnswerText = JSON.parse(modelAnswerText);

			console.log(JSON.stringify(modelAnswerText));

			let test = {
				"id_przedmiotu": przedmiot,
				"id_usera": socket.handshake.session.userId,
				"id_przedmiotu": przedmiot,
				"nazwa_przedmiotu": nazwa_przedmiotu,
				"numer_dzialu": dzial,
				"nazwa_dzialu": nazwa_dzialu,
				"data_utworzenia": new Date(),
				"ukonczony": false,
				"pytania": modelAnswerText.pytania
			};

			let testId = await testyCollection.insertOne(test);
			testId = testId.insertedId;

			let testFrontend = {
				"id_testu": testId,
				"nazwa_przedmiotu": nazwa_przedmiotu,
				"numer_dzialu": dzial,
				"nazwa_dzialu": nazwa_dzialu,
				"pytania": modelAnswerText.pytania
			};

			socket.emit('generujTest', 'success', testFrontend);
			await session.commitTransaction();
			
		} catch (e) {
			await session.abortTransaction();
			await client.close();
							
			let errDisplayContent = {
				"userMessage": "Połączenie z bazą danych zostało przerwane.",
				"errorCode": "ERR_DB_EXCEPTION",
				"task": "TASK_SEARCH_SECTION",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": false,
				"takeAction": "none",
				"actionTimeout": 0
			};
			socket.emit('errDisplay', errDisplayContent);
			socket.emit('generujTest', 'failed');
			
			throw e;
			
		} finally {
			await session.endSession();
			await client.close();
		}
		
	}
	
	run().catch(console.error);
}

function wczytajPoprzedniTest(socket, poprzedniTestId) {
	async function run() {
		let userId = socket.handshake.session.userId;
		let sessionId = socket.handshake.session.sessionId;
		if(!userId) {
			socket.emit('startup', 'auth-redirection');
		}
	
		const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
		const client = new MongoClient(uri);
		
		await client.connect();
        const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
		const tematyCollection = db.collection("tematy");
		const przedmiotyCollection = db.collection("przedmioty");
		const funkcjeCollection = db.collection("funkcje");
		const testyCollection = db.collection("testy");
		const userzyCollection = db.collection("uzytkownicy");
		
		const { ObjectId } = new require('mongodb');

		session.startTransaction();
		try {

			let test = await testyCollection.find({ _id: new ObjectId(poprzedniTestId) }).toArray({ session });
			let testIdString = test[0]._id.toString();

			let testFrontend = {
				"id_testu": testIdString,
				"nazwa_przedmiotu": test[0].nazwa_przedmiotu,
				"numer_dzialu": test[0].dzial,
				"nazwa_dzialu": test[0].nazwa_dzialu,
				"pytania": test[0].pytania
			};

			socket.emit('wczytajPoprzedniTest', 'success', testFrontend);
			await session.commitTransaction();
			
		} catch (e) {
			await session.abortTransaction();
			await client.close();
							
			let errDisplayContent = {
				"userMessage": "Połączenie z bazą danych zostało przerwane.",
				"errorCode": "ERR_DB_EXCEPTION",
				"task": "TASK_SEARCH_SECTION",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": false,
				"takeAction": "none",
				"actionTimeout": 0
			};
			socket.emit('errDisplay', errDisplayContent);
			socket.emit('wczytajPoprzedniTest', 'failed');
			
			throw e;
			
		} finally {
			await session.endSession();
			await client.close();
		}
		
	}
	
	run().catch(console.error);
}

function zakonczTest(socket, wynik) {
	async function run() {
		let userId = socket.handshake.session.userId;
		let sessionId = socket.handshake.session.sessionId;
		if(!userId) {
			socket.emit('startup', 'auth-redirection');
		}
		
		const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
		const client = new MongoClient(uri);
		
		await client.connect();
        const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
		const testyCollection = db.collection("testy");
		
		const { ObjectId } = new require('mongodb');
		
		session.startTransaction();
		try {
			
			let test = await testyCollection.find({ _id: new ObjectId(wynik.id_testu) }).toArray({ session });
			if (test.length !== 1) {
				socket.emit('zakonczTest', 'testNotFound');
				return;
			}

			let testId = wynik.id_testu;


			const updateResult = await testyCollection.updateOne(
                { _id: new ObjectId(testId) },
                { $set: { ukonczony: true, pytania: wynik.pytania } },
                { session }
            );
			
			await session.commitTransaction();
			socket.emit('zakonczTest', 'success');
			
		} catch (e) {
			await session.abortTransaction();
			await client.close();
							
			let errDisplayContent = {
				"userMessage": "Połączenie z bazą danych zostało przerwane.",
				"errorCode": "ERR_DB_EXCEPTION",
				"task": "TASK_SEARCH_SECTION",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": false,
				"takeAction": "none",
				"actionTimeout": 0
			};
			socket.emit('errDisplay', errDisplayContent);
			socket.emit('zakonczTest', 'failed');
			
			throw e;
			
		} finally {
			await session.endSession();
			await client.close();
		}
		
	}
	
	run().catch(console.error);
}


























































async function presentation(data, filename) {

    let pptx = new pptxgen();

    pptx.author = data.author;
    pptx.subject = data.subject;
    pptx.title = data.title;
	console.log(data.title);
    pptx.layout = "LAYOUT_16x9";

    pptx.theme = { headFontFace: "Aptos" };
    pptx.theme = { bodyFontFace: "Aptos" };

    let titleslide = pptx.addSlide();
    titleslide.addText( data.subject.toUpperCase(), { x: 0.125, y: 0.275, align: "left", fontSize: 12, bold: true, color: "878787" } );
    titleslide.addText( data.title, { x: 1.25, y: 2.75, align: "center", fontSize: 42, bold: true } );

    for(let slide of data.slides) {
        if(slide.type === "text") {
            let slidepptx = pptx.addSlide();
            let addText = [];

            for(let content of slide.content) {
                if(content.bulletpoint) {
                    addText.push({ text: content.content, options: { bullet: true, breakLine: true } });
                } else {
                    addText.push({ text: content.content, options: { breakLine: true } });
                }

            }
            
            slidepptx.addText( slide.title, { x: 0.25, y: 0.5, align: "left", fontSize: 32, bold: true, w: 9.5 } );
            slidepptx.addText("", {
                shape: pptx.ShapeType.line,
                line: { color: "b2b2b2", width: 1.5, dashType: "solid" },
                x: 0.25, y: 1, w: 9.5, h: 0
            });

            slidepptx.addText(addText, { x: 0.25, y: 1.25, align: "left", fontSize: 14, w: 9.5, h: 4, valign: "top" } );

        } else if(slide.type === "textimage") {
            let slidepptx = pptx.addSlide();
            let addText = [];

            for(let content of slide.content) {
                if(content.bulletpoint) {
                    addText.push({ text: content.content, options: { bullet: true, breakLine: true } });
                } else {
                    addText.push({ text: content.content, options: { breakLine: true } });
                }

            }
            
            slidepptx.addText( slide.title, { x: 0.25, y: 0.5, align: "left", fontSize: 32, bold: true, w: 9.5 } );
            slidepptx.addText("", {
                shape: pptx.ShapeType.line,
                line: { color: "b2b2b2", width: 1.5, dashType: "solid" },
                x: 0.25, y: 1, w: 9.5, h: 0
            });

            slidepptx.addText(addText, { x: 0.25, y: 1.25, align: "left", fontSize: 14, w: 4.5, h: 4, valign: "top" } );

            let imageUrl = await getImage(slide.image_search_query);
            
            if(imageUrl) {
                slidepptx.addImage({ path: imageUrl, x: 5, y: 1.25, w: 4.5, h: 4 });
            } else {
                slidepptx.addText("Nie udało się znaleźć odpowiedniego obrazka.", { x: 5, y: 1.25, w: 4.5, h: 4, align: "center", fontSize: 14, valign: "center" });
            }
        } else if(slide.type === "image") {
            let slidepptx = pptx.addSlide();
        
            slidepptx.addText( slide.title, { x: 0.25, y: 0.5, align: "left", fontSize: 32, bold: true, w: 9.5 } );
            slidepptx.addText("", {
                shape: pptx.ShapeType.line,
                line: { color: "b2b2b2", width: 1.5, dashType: "solid" },
                x: 0.25, y: 1, w: 9.5, h: 0
            });

            let imageUrl = await getImage(slide.image_search_query);
            
            if(imageUrl) {
                slidepptx.addImage({ path: imageUrl, x: 0.25 , y: 1.25, w: 9.5, h: 4 });
            } else {
                slidepptx.addText("Nie udało się znaleźć odpowiedniego obrazka.", { x: 0.25, y: 1.25, w: 9.5, h: 4, align: "center", fontSize: 14, valign: "center" });
            }
        }
    }

    let endingslide = pptx.addSlide();
    endingslide.addText(
        [
            { text: "Dziękuję za uwagę", options: { breakLine: true, fontSize: 42, bold: true } }, 
            { text: "Autor: ", options: { fontSize: 24, bold: true } }, 
            { text: data.author, options: { fontSize: 24, bold: false } }, 
        ],
        { x: 1.25, y: 2.75, align: "center" }
    );

    if(data.sources && data.sources.length > 0) {
        console.log('WIP: Sources slide');
    }

	await pptx.writeFile({ fileName: filename + '.pptx' });
	await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds for the file to be written
	await fs.promises.access(filename + '.pptx', fs.constants.F_OK);

	return filename + '.pptx';
}

async function getImage(query) {
    try {
        const response = await axios.get('https://api.unsplash.com/search/photos', {
            params: { query: query, per_page: 1 },
            headers: {
                Authorization: 'Client-ID ' + process.env.UNSPLASH_ACCESS_KEY
            }
        });
        if (response.data.results.length > 0) {
            return response.data.results[0].urls.full;
        }
    } catch (error) {
        console.error('Error fetching image:', error);
    }

    return null;
}

async function pptxApi(socket, idPrzedmiotu, wybraneTematy, tematAlternative, aiModel, wiecejInfo) {
	async function run() {
		let userId = socket.handshake.session.userId;
		let sessionId = socket.handshake.session.sessionId;
		if(!userId) {
			socket.emit('startup', 'auth-redirection');
		}
	
		const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
		const client = new MongoClient(uri);
		
		await client.connect();
        const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
		const tematyCollection = db.collection("tematy");
		const przedmiotyCollection = db.collection("przedmioty");
		const funkcjeCollection = db.collection("funkcje");
		const prezentacjeCollection = db.collection("prezentacje");
		const userzyCollection = db.collection("uzytkownicy");
		
		const { ObjectId } = new require('mongodb');

		session.startTransaction();
		try {

			let promptSystemowy = await przedmiotyCollection.find({ _id: new ObjectId(idPrzedmiotu) }).toArray({ session });
			if (promptSystemowy.length !== 1) {
				socket.emit('startup', 'banned');
				return;
			}

			promptSystemowy = promptSystemowy[0].pptx_prompt;

			let tematyPrompt = '';
			if (wybraneTematy && wybraneTematy.length === 0) {
				console.log(0)
				socket.emit('pptxApi', 'failed', 'Nie wybrano żadnych tematów (1)');
				return;
			} else if(wybraneTematy && wybraneTematy.length > 0) {
				console.log(1);
				for (let tematId of wybraneTematy) {
					let temat = await tematyCollection.find({ id_przedmiotu: idPrzedmiotu, _id: new ObjectId(tematId) }).toArray({ session });
					if (temat.length === 0) {
						console.log('Temat nie znaleziony');
						socket.emit('pptxApi', 'failed', 'Nie znaleziono szukanego tematu');
						return;
					}
	
					tematyPrompt = tematyPrompt + temat[0].tresc + "\n";
					tematyPrompt = tematyPrompt + temat[0].zadania + "\n";
					tematyPrompt = tematyPrompt + temat[0].tytul_tematu + "\n";
					tematyPrompt = tematyPrompt + temat[0].strona_koniec + "\n";
					tematyPrompt = tematyPrompt + temat[0].strona_start + "\n";
				}
			} else if(tematAlternative && tematAlternative.length >= 3) {
				console.log(2)
				tematyPrompt = tematAlternative;
			} else {
				console.log(3)
				socket.emit('pptxApi', 'failed', 'Nie wybrano żadnych tematów (2)');	
			}

			let calyPrompt =  tematyPrompt + "\n\n\n\nDodatkowe informacje od użytkownika dotyczące stylu generowanej prezentacji" + wiecejInfo;

			const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
			const model = genAI.getGenerativeModel({
				model: aiModel,
				systemInstruction: promptSystemowy,
			});

			let funkcjaInfo = await funkcjeCollection.find({ nazwa: "prezentacje" }).toArray({ session });
			if(funkcjaInfo.length !== 1) {
				socket.emit('startup', 'banned');
				return;
			}

			if(funkcjaInfo[0].modele_ai.filter(model => model.nazwa_modelu === aiModel)[0].uzytkownicy.filter(user => user.id_usera === userId).length !== 1) {
				console.log('Nie masz dostępu do tego modelu');
				socket.emit('pptxApi', 'failed', 'Nie masz dostępu do tego modelu');
			}

			// ---
			// Sprawdź, czy wygenerowanie nie spowoduje przekroczenia limitu wydatków

			// Count tokens in a prompt without calling text generation.
			const countResult = await model.countTokens(calyPrompt);

			let tokenowWyslanych = countResult.totalTokens;

			let cena1tIn = funkcjaInfo[0].modele_ai.filter(modelA => modelA.nazwa_modelu === aiModel)[0].cena_1t_in;
			cena1tIn = parseFloat(cena1tIn);

			let kosztGenerowania = parseFloat((tokenowWyslanych * cena1tIn));

			let userInfo = await userzyCollection.find({ _id: new ObjectId(socket.handshake.session.userId) }).toArray({ session });
			let aktualnieWydaneUser = parseFloat(userInfo[0].wydal.toString());
			let limitWydatkow = parseFloat(userInfo[0].limit_wydatkow.toString());

			if(aktualnieWydaneUser + kosztGenerowania > limitWydatkow) {
				console.log('Przekroczono limit wydatków');
				socket.emit('pptxApi', 'failed', 'Przekroczono limit wydatków');
				return;
			}

			// ---

			const generationConfig = {
				temperature: 0.95,
				topP: 0.95,
				topK: 40,
				maxOutputTokens: 8192,
				responseMimeType: "application/json",
				responseSchema: {
					type: "object",
					properties: {
						slides: {
						type: "array",
						items: {
							type: "object",
							properties: {
							type: {
								type: "string"
							},
							title: {
								type: "string"
							},
							content: {
								type: "array",
								items: {
								type: "object",
								properties: {
									bulletpoint: {
									type: "boolean"
									},
									content: {
									type: "string"
									}
								},
								required: [
									"content"
								]
								}
							},
							image_search_query: {
								type: "string"
							}
							},
							required: [
							"type",
							"title"
							]
						}
						}
					},
					required: [
						"slides"
					]
				},
			};

			async function generate() {
				const chatSession = model.startChat({
				  generationConfig
				});
			  
				const result = await chatSession.sendMessage(calyPrompt);
				return result;
			}
			  
			let modelAnswer = await generate();
			let modelAnswerJSON = modelAnswer.response.text();

			let inputTokensPrompt = await model.countTokens(calyPrompt);
			let outputTokensPrompt = await model.countTokens(JSON.stringify(modelAnswerJSON));

			let inputTokens = inputTokensPrompt.totalTokens;
			let outputTokens = outputTokensPrompt.totalTokens;

			if(modelAnswer.response.candidates.finishReason === "MAX_TOKENS") {
				let maxTries = 5;
				let tries = 0;
				let generateMore = true;

				let messageHistory = [
					{
						"role": "user",
						"parts": [
							{
								"text": calyPrompt
							}
						]
					},
					{
						"role": "model",
						"parts": [
							{
								"text": modelAnswerJSON
							}
						]
					}
				];

				modelAnswerJSON = jsonrepair(modelAnswerJSON);
				modelAnswerJSON = JSON.parse(modelAnswerJSON);
				
				delete modelAnswerJSON.pytania[modelAnswerJSON.pytania.length - 1];
				
				while(generateMore && tries < maxTries) {
					console.log('Generuję więcej');
					tries++;

					async function more() {
						const chatSession = model.startChat({
							generationConfig,
							history: messageHistory,
						});
						
						const result = await chatSession.sendMessage("Kontynuuj");
						return result;
					}
					
					let modelAnswerMore = await more();
					let modelAnswerTextMore = modelAnswerMore.response.text();

					inputTokensPrompt = await model.countTokens(calyPrompt);
					outputTokensPrompt = await model.countTokens(modelAnswerTextMore);

					inputTokens = inputTokens + inputTokensPrompt.totalTokens;
					outputTokens = outputTokens + outputTokensPrompt.totalTokens;
					
					if(modelAnswerMore.response.candidates.finishReason !== "MAX_TOKENS") {
						generateMore = false;
						modelAnswerTextMore = jsonrepair(modelAnswerTextMore);
						modelAnswerTextMore = JSON.parse(modelAnswerTextMore);
						modelAnswerText.pytania = modelAnswerJSON.pytania.concat(modelAnswerTextMore.pytania);
					} else {
						modelAnswerTextMore = jsonrepair(modelAnswerTextMore);
						modelAnswerTextMore = JSON.parse(modelAnswerTextMore);
						delete modelAnswerTextMore.pytania[modelAnswerTextMore.pytania.length - 1];

						modelAnswerJSON.pytania = modelAnswerJSON.pytania.concat(modelAnswerTextMore.pytania);
					}

				}

				if(tries === maxTries) {
					socket.emit('generujTest', 'failed');
					return;
				}
			}

			// Nadaj tytuł prezentacji
			const generationConfigTitle = {
				temperature: 0.95,
				topP: 0.95,
				topK: 40,
				maxOutputTokens: 128,
				responseMimeType: "text/plain",
			};

			const modelTitle = genAI.getGenerativeModel({
				model: aiModel,
				systemInstruction: "Na podstawie kodu JSON przesłanego przez użytkownika, który zawiera prezentację, wygeneruj tytuł prezentacji. Twoja odpowiedź musi zawierać wyłącznie tytuł prezentacji. Tytuł musi być krótki i jak najlepiej ma odzwierciedlać treść prezentacji. Zwróć uwagę na poprawność językową i gramatyczną.",
			});

			async function generateTitle() {
				const chatSession = modelTitle.startChat({
					generationConfigTitle
				});
			  
				const result = await chatSession.sendMessage(JSON.stringify(modelAnswerJSON));
				return result;
			}
			  
			let modelAnswerTitle = await generateTitle();
			let modelAnswerTitleText = modelAnswerTitle.response.text();

			let inputTokensPromptTitle = await model.countTokens(JSON.stringify(modelAnswerJSON));
			let outputTokensPromptTitle = await model.countTokens(modelAnswerTitleText);

			inputTokens = inputTokens + inputTokensPromptTitle.totalTokens;
			outputTokens = outputTokens + outputTokensPromptTitle.totalTokens;

			let sumaTokenow = inputTokens + outputTokens;

			userInfo = await userzyCollection.find({ _id: new ObjectId(socket.handshake.session.userId) }).toArray({ session });
			aktualnieWydaneUser = parseFloat(userInfo[0].wydal.toString());

			let cena1tOut = funkcjaInfo[0].modele_ai.filter(modelA => modelA.nazwa_modelu === aiModel)[0].cena_1t_out;
			cena1tOut = parseFloat(cena1tOut);

			let kosztIn = sumaTokenow * cena1tIn;
			let kosztOut = sumaTokenow * cena1tOut;

			let aktualnieWydaneFunkcja = parseFloat(funkcjaInfo[0].uzytkownicy.filter(user => user.id_usera === socket.handshake.session.userId)[0].wydal.toString());
			let aktualnieWydaneModel = parseFloat(funkcjaInfo[0].modele_ai.filter(modelA => modelA.nazwa_modelu === aiModel)[0].uzytkownicy.filter(user => user.id_usera === socket.handshake.session.userId)[0].wydal.toString());

			aktualnieWydaneUser = aktualnieWydaneUser + kosztIn + kosztOut;
			aktualnieWydaneUser = aktualnieWydaneUser.toString();
			aktualnieWydaneFunkcja = aktualnieWydaneFunkcja + kosztIn + kosztOut;
			aktualnieWydaneFunkcja = aktualnieWydaneFunkcja.toString();
			aktualnieWydaneModel = aktualnieWydaneModel + kosztIn + kosztOut;
			aktualnieWydaneModel = aktualnieWydaneModel.toString();

			await funkcjeCollection.updateOne(
				{ nazwa: "prezentacje", "modele_ai.nazwa_modelu": aiModel, "modele_ai.uzytkownicy.id_usera": socket.handshake.session.userId },
				{ $set: { "modele_ai.$[model].uzytkownicy.$[user].wydal": Decimal128.fromString(aktualnieWydaneFunkcja) } },
				{ arrayFilters: [{ "model.nazwa_modelu": aiModel }, { "user.id_usera": userId }] }
			);

			await funkcjeCollection.updateOne(
				{ nazwa: "prezentacje", "uzytkownicy.id_usera": socket.handshake.session.userId },
				{ $set: { "uzytkownicy.$[user].wydal": Decimal128.fromString(aktualnieWydaneModel) } },
				{ arrayFilters: [{ "user.id_usera": userId }] }
			);

			await userzyCollection.updateOne(
				{ _id: new ObjectId(socket.handshake.session.userId) },
				{ $set: { "wydal": Decimal128.fromString(aktualnieWydaneUser) } },
				{ session }
			);

			let getPrzedmiotFromDb = await przedmiotyCollection.findOne({ _id: new ObjectId(idPrzedmiotu) }, { session })
			let nazwa_przedmiotu = getPrzedmiotFromDb.przedmiot;

			let wybraneTematyDb = null;
			if(wybraneTematy && wybraneTematy.length > 0) {
				wybraneTematyDb = wybraneTematy
			} else {
				wybraneTematyDb = tematAlternative
			}

			modelAnswerJSON = jsonrepair(modelAnswerJSON);
			modelAnswerJSON = JSON.parse(modelAnswerJSON);

			console.log(JSON.stringify(modelAnswer));
			console.log('\n\n\n\n\n');
			console.log(modelAnswerJSON);

			nazwa_przedmiotu = nazwa_przedmiotu === "Pozostałe" ? tematAlternative : nazwa_przedmiotu;

			let pptxDb = {
				"id_usera": socket.handshake.session.userId,
				"imie_nazwisko": socket.handshake.session.imie + ' ' + socket.handshake.session.nazwisko,
				"id_przedmiotu": idPrzedmiotu,
				"nazwa_przedmiotu": nazwa_przedmiotu,
				"tytul": modelAnswerTitleText,
				"slajdy": modelAnswerJSON.slides,
				"data_utworzenia": new Date(),
				"wybrane_tematy": wybraneTematyDb,
				"model_ai": aiModel,
				"wiecej_info": wiecejInfo,
				"plik_dostepny": false
			};

			let pptxId = await prezentacjeCollection.insertOne(pptxDb);
			pptxId = pptxId.insertedId;

			let pptxData = {
				"_id": pptxId,
				"id_usera": socket.handshake.session.userId,
				"id_przedmiotu": idPrzedmiotu,
				"author": socket.handshake.session.imie + ' ' + socket.handshake.session.nazwisko,
				"subject": nazwa_przedmiotu,
				"title": modelAnswerTitleText,
				"slides": modelAnswerJSON.slides,
			};

			let pptxGenerated = await presentation(pptxData, pptxId);
			if(!pptxGenerated) {
				console.log('Plik nie istnieje (?)')
			}

			const filePath = pptxId + '.pptx';
			let retries = 5;
			let delay = 8000; // 8 seconds

			for (let i = 0; i < retries; i++) {
				if (fs.existsSync(path.join(__dirname, filePath))) {
					await prezentacjeCollection.updateOne({ _id: new ObjectId(pptxId) }, { $set: { plik_dostepny: true } }, { session });
					break;
				} else if (i === retries) {
					console.log('Plik nie istnieje (?)')
					socket.emit('pptxApi', 'failed', 'Plik nie został utworzony');
					return;
				} else {
					await new Promise(resolve => setTimeout(resolve, delay));
				}
			}

			const bucketName = process.env.GCS_BUCKET_NAME;
			const destFileName = 'usercontent/pptx/' + pptxId + '.pptx';

			const storage = new Storage();

			async function uploadFile() {
				try {
				const options = {
				  destination: destFileName,
				};
			
				await storage.bucket(bucketName).upload(filePath, options);
				} catch (e) {
					console.log('Nie udało się wrzucić pliku na serwer');
					socket.emit('pptxApi', 'failed', 'Nie udało się wrzucić pliku na serwer');
					throw(e);
				}
			}
			
			await uploadFile().catch(console.error);

			fs.unlink(filePath, (err) => {
				if (err) {
					console.error(err);
					return;
				}
			});

			socket.emit('pptxApi', 'success', pptxId);
			await session.commitTransaction();
			
		} catch (e) {
			await session.abortTransaction();
			await client.close();
							
			let errDisplayContent = {
				"userMessage": "Połączenie z bazą danych zostało przerwane.",
				"errorCode": "ERR_DB_EXCEPTION",
				"task": "TASK_SEARCH_SECTION",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": false,
				"takeAction": "none",
				"actionTimeout": 0
			};
			socket.emit('errDisplay', errDisplayContent);
			console.log('pptxApi failed');
			socket.emit('pptxApi', 'failed', 'Nieoczekiwany wyjątek. Skontaktuj się z administratorem.');
			
			throw e;
			
		} finally {
			await session.endSession();
			await client.close();
		}
		
	}
	
	run().catch(console.error);
}

// presentation(data);

function tematyDialog(socket, przedmiotId) {
	async function run() {
		let userId = socket.handshake.session.userId;
		let sessionId = socket.handshake.session.sessionId;
		if(!userId) {
			socket.emit('startup', 'auth-redirection');
		}
	
		const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
		const client = new MongoClient(uri);
		
		await client.connect();
        const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
		const tematyCollection = db.collection("tematy");
		const przedmiotyCollection = db.collection("przedmioty");
		
		const { ObjectId } = new require('mongodb');

		session.startTransaction();
		try {

			let przedmioty = await przedmiotyCollection.find({ _id: new ObjectId(przedmiotId) }).toArray({ session });
			if (przedmioty.length !== 1) {
				socket.emit('tematyDialog', false);
				return;
			}

			let tematy = await tematyCollection.find({ id_przedmiotu: przedmiotId }).toArray({ session });
			if (tematy.length === 0) {
				socket.emit('tematyDialog', false	);
				return;
			}

			let tematySend = [];

			for (let i = 0; i < tematy.length; i++) {
				const temat = tematy[i];
			
				// Sprawdź, czy dany dział już istnieje w tematySend
				let dzial = tematySend.find(d => d.numer_dzialu === temat.dzial);
			
				if (!dzial) {
					// Jeśli nie istnieje, utwórz nowy dział
					dzial = {
						numer_dzialu: temat.dzial,
						nazwa_dzialu: temat.nazwa_dzialu,
						tematy: []
					};
					tematySend.push(dzial);
				}
			
				// Dodaj temat do odpowiedniego działu
				dzial.tematy.push({
					numer_tematu: temat.numer_tematu,
					nazwa_tematu: temat.tytul_tematu,
					_id: temat._id
				});
			}

			if(tematy.length === 0) {
				tematy = false;
			}

			socket.emit('tematyDialog', tematySend);
			await session.commitTransaction();
			
		} catch (e) {
			await session.abortTransaction();
			await client.close();
							
			let errDisplayContent = {
				"userMessage": "Połączenie z bazą danych zostało przerwane.",
				"errorCode": "ERR_DB_EXCEPTION",
				"task": "TASK_SEARCH_SECTION",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": false,
				"takeAction": "none",
				"actionTimeout": 0
			};
			socket.emit('errDisplay', errDisplayContent);
			
			throw e;
			
		} finally {
			await session.endSession();
			await client.close();
		}
		
	}
	
	run().catch(console.error);
}

function obliczKosztyPptx(socket, idPrzedmiotu, wybraneTematy, tematAlternative, aiModel, wiecejInfo) {
	async function run() {
		let userId = socket.handshake.session.userId;
		let sessionId = socket.handshake.session.sessionId;
		if(!userId) {
			socket.emit('startup', 'auth-redirection');
		}
	
		const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
		const client = new MongoClient(uri);
		
		await client.connect();
        const session = client.startSession();
		
		const db = client.db("szkolny-copilot");
		const tematyCollection = db.collection("tematy");
		const przedmiotyCollection = db.collection("przedmioty");
		const funkcjeCollection = db.collection("funkcje");
		
		const { ObjectId } = new require('mongodb');

		session.startTransaction();
		try {

			let przedmiotInfo = await przedmiotyCollection.find({ _id: new ObjectId(idPrzedmiotu) }).toArray({ session });
			if (przedmiotInfo.length !== 1) {
				socket.emit('pptxApi', 'failed', 'Nie znaleziono przedmiotu');
				return;
			}

			let promptSystemowy = przedmiotInfo[0].pptx_prompt;

			let tematyPrompt = '';
			if (wybraneTematy && wybraneTematy.length === 0) {
				socket.emit('pptxApi', 'failed', 'Nie wybrano żadnych tematów');
				return;
			} else if(wybraneTematy && wybraneTematy.length > 0) {
				for (let tematId of wybraneTematy) {
					let temat = await tematyCollection.find({ id_przedmiotu: idPrzedmiotu, _id: new ObjectId(tematId) }).toArray({ session });
					if (temat.length === 0) {
						socket.emit('pptxApi', 'failed', 'Nie znaleziono szukanego tematu');
						return;
					}
	
					tematyPrompt = tematyPrompt + temat[0].tresc + "\n";
					tematyPrompt = tematyPrompt + temat[0].zadania + "\n";
					tematyPrompt = tematyPrompt + temat[0].tytul_tematu + "\n";
					tematyPrompt = tematyPrompt + temat[0].strona_koniec + "\n";
					tematyPrompt = tematyPrompt + temat[0].strona_start + "\n";
				}
			} else if(tematAlternative && tematAlternative.length >= 3) {
				tematyPrompt = tematAlternative;
			} else {
				socket.emit('pptxApi', 'failed', 'Nie wybrano żadnych tematów');	
			}

			let calyPrompt = promptSystemowy + "\n" + tematyPrompt + "\n" + wiecejInfo;

			const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
			const model = genAI.getGenerativeModel({
				model: aiModel,
			});

			// Count tokens in a prompt without calling text generation.
			const countResult = await model.countTokens(calyPrompt);

			let sumaTokenow = countResult.totalTokens;

			let funkcjaInfo = await funkcjeCollection.find({ nazwa: "prezentacje" }).toArray({ session });
			if(funkcjaInfo.length !== 1) {
				socket.emit('pptxApi', 'failed', 'Nie znaleziono funkcji');
				return;
			}

			let cena1tIn = funkcjaInfo[0].modele_ai.filter(model => model.nazwa_modelu === aiModel);
			cena1tIn = cena1tIn[0].cena_1t_in;
			cena1tIn = parseFloat(cena1tIn);

			let kosztGenerowania = parseFloat(sumaTokenow) * cena1tIn * 3;
			kosztGenerowania = kosztGenerowania.toFixed(2);
			kosztGenerowania = kosztGenerowania.toString().replace(".", ",");

			socket.emit('obliczKosztyPptx', kosztGenerowania);
			await session.commitTransaction();
			
		} catch (e) {
			await session.abortTransaction();
			await client.close();
							
			let errDisplayContent = {
				"userMessage": "Połączenie z bazą danych zostało przerwane.",
				"errorCode": "ERR_DB_EXCEPTION",
				"task": "TASK_SEARCH_SECTION",
				"showBox": true,
				"hideAfter": 10000,
				"autoReport": false,
				"takeAction": "none",
				"actionTimeout": 0
			};
			socket.emit('errDisplay', errDisplayContent);
			socket.emit('pptxApi', 'failed', 'Nieoczekiwany wyjątek. Skontaktuj się z administratorem.');
			
			throw e;
			
		} finally {
			await session.endSession();
			await client.close();
		}
		
	}
	
	run().catch(console.error);
}




















module.exports = {
	handleAiRequest,
	przedmiotyDropdown,
	startChat,
	aiModelDropdown,
	updateChatTitle,
	znajdzTemat,
	saveReport,
	startup,
	dzialDropdown,
	obliczKosztyGenerowaniaTestu,
	generujTest,
	wczytajPoprzedniTest,
	zakonczTest,
	pptxApi,
	tematyDialog,
	obliczKosztyPptx
};
