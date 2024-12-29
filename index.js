const express = require('express');
const app = express();
const path = require('path');
var http = require('http').Server(app);
var io = require('socket.io')(http);
// var jquery = require('jquery');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const sharedsession = require("express-socket.io-session");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config({ path: path.join(__dirname, '.env') });
var cron = require('node-cron');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(express.static(path.join(__dirname, "public")));
app.use('/flowbite', express.static(__dirname + '/node_modules/flowbite/dist/'));
app.use('/jquery', express.static(__dirname + '/node_modules/jquery/dist/'));
app.use('/socketio', express.static(__dirname + '/node_modules/socket.io/client-dist/'));

// Session
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    // Temporaily disabled secure cookies for development
    cookie: { secure: false }
});

const sessionMogno = session({
    secret: process.env.SESSION_SECRET,
    store: MongoStore.create({ mongoUrl: "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME, dbName: 'copilot-sessions' }),
    ttl: 6 * 60 * 60,
    autoRemove: 'native'
});

app.use(sessionMogno);

io.use(sharedsession(sessionMogno, {
    autoSave: true
}));

app.get('/', (req, res) => {
    if(req.session.loggedin) {
        // req.session.activestate = 'active';
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(404)
        res.redirect('/auth');
    }
});

app.get('/polityka_prywatnosci', (req, res) => {
    if(req.session.loggedin) {
        // req.session.activestate = 'active';
        res.sendFile(path.join(__dirname, 'public', 'polityka_prywatnosci.html'));
    } else {
        res.status(404)
        res.redirect('/auth');
    }
});

app.get('/logout', (req, res) => {

    const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
    const client = new MongoClient(uri);

    async function connectToDb() {
        try {
            await client.connect();
            await client.db("szkolny-copilot").collection("sesje").updateOne({ _id: req.session.sessionId }, { $set: { ended: true, end_date: new Date(), end_reason: 'logout' } });
        } catch (e) {
            console.error(e);
            res.redirect('/auth?error=2');
        } finally {
            await client.close();
        }
    }

    connectToDb().catch(console.error);
    req.session.destroy();
    res.redirect('/auth');
});

app.get('/chat', (req, res) => {
    if(req.session.loggedin) {
        // req.session.activestate = 'active';
        res.sendFile(path.join(__dirname, 'public', 'chat.html'));
    } else {
        res.status(404)
        res.redirect('/auth');
    }
});

app.get('/rozwiazania_zadan', (req, res) => {
    if(req.session.loggedin) {
        // req.session.activestate = 'active';
        res.sendFile(path.join(__dirname, 'public', 'rozwiazania_zadan.html'));
    } else {
        res.status(404)
        res.redirect('/auth');
    }
});

app.get('/generator_testow', (req, res) => {
    if(req.session.loggedin) {
        // req.session.activestate = 'active';
        res.sendFile(path.join(__dirname, 'public', 'generator_testow.html'));
    } else {
        res.status(404)
        res.redirect('/auth');
    }
});

app.get('/prezentacje', (req, res) => {
    if(req.session.loggedin) {
        // req.session.activestate = 'active';
        res.sendFile(path.join(__dirname, 'public', 'prezentacje.html'));
    } else {
        res.status(404)
        res.redirect('/auth');
    }
});

app.get('/podreczniki3tech', (req, res) => {
    if(req.session.loggedin) {
        res.redirect('https://rabbitxone.notion.site/Podr-czniki-elektroniczne-a45481e183074f13bbd5e49c0a033b54');
    } else {
        res.status(404)
        res.redirect('/auth');
    }
});

app.get('/hasloreset', (req, res) => {
    if(req.session.loggedin) {
        res.sendFile(path.join(__dirname, 'public', 'hasloreset.html'));
    } else {
        res.status(404)
        res.redirect('/auth');
    }
});

app.get('/auth', (req, res) => {
    if(req.session.loggedin) {
        res.redirect('/');
    } else {
        // req.session.activestate = 'active';
        res.sendFile(path.join(__dirname, 'public', 'auth.html'));
    }
});

// app.get('/slides', (req, res) => {
//     req.session.activestate = 'active';
//     res.sendFile(path.join(__dirname, 'public', 'slides.html'));
// });

// ---

app.get('/css/output.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/css/', 'output.css'));
});

app.get('/css/global.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/css/', 'global.css'));
});

app.get('/js/chat.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/js/', 'chat.js'));
});

app.get('/js/generator_testow.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/js/', 'generator_testow.js'));
});

app.get('/js/prezentacje.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/js/', 'prezentacje.js'));
});

app.get('/js/tabcomplete.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/js/', 'tabcomplete.js'));
});

app.get('/img/book-with-green-board-background.jpg', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/img/', 'book-with-green-board-background.jpg'));
});

app.get('/robots.txt', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/', 'robots.txt'));
});

// ---
// Favicon

app.get('/favicon/apple-touch-icon.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/favicon/', 'apple-touch-icon.png'));
});

app.get('/favicon/favicon-96x96.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/favicon/', 'favicon-96x96.png'));
});

app.get('/favicon/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/favicon/', 'favicon.ico'));
});

app.get('/favicon/favicon.svg', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/favicon/', 'favicon.svg'));
});

app.get('/favicon/site.webmanifest', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/favicon/', 'site.webmanifest'));
});

app.get('/favicon/web-app-manifest-192x192.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/favicon/', 'web-app-manifest-192x192.png'));
});

app.get('/favicon/web-app-manifest-512x512.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/favicon/', 'web-app-manifest-512x512.png'));
});

app.post('/authorize', function(req, res) {
	// Capture the input fields
	let login = req.body.login;
	let password = req.body.password;

    // Hash the password
    const bcrypt = require('bcrypt');
    const saltRounds = 10;

    hashedPass = bcrypt.hashSync(password, saltRounds);

	// Ensure the input fields exists and are not empty
	if (login && hashedPass) {

        // if(login === 'admin' && password === 'admin') {
        //     req.session.loggedin = true;
        //     req.session.login = login;

        //     res.redirect('/');
        //     return;
        // } else {
        //     res.redirect('/auth?error=1');
        // }

        const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
        const client = new MongoClient(uri);
    
        async function connectToDb() {
            try {
                await client.connect();
                let userzy = await client.db("szkolny-copilot").collection("uzytkownicy").find({ login: login }).toArray();

                if(userzy.length > 0) {
                    if(userzy[0].zbanowany === true) {
                        // User jest zbanowany
                        // Zezwól na zalogowanie, ale zablokuj dostęp do reszty
                        console.log('Zbanowany uzytkownik zalogowal sie: ' + login);
                    }

                    var userId = userzy[0]._id;

                    if(!bcrypt.compareSync(password, userzy[0].haslo)) {
                        // Hasło nieprawidłowe
                        res.redirect('/auth?error=1');
                        return;
                    }
                    
                    // Zaktualizuj datę ostatniego logowania w formacie: 1999-12-31T23:00:00.000+00:00
                    const { ObjectId } = new require('mongodb');
                    await client.db("szkolny-copilot").collection("uzytkownicy").updateOne({ _id: new ObjectId(userId) }, { $set: { data_ostatniego_logowania: new Date() } });
                    
                    if(userzy[0].data_pierwszego_logowania === null) {
                        await client.db("szkolny-copilot").collection("uzytkownicy").updateOne({ _id: new ObjectId(userId) }, { $set: { data_pierwszego_logowania: new Date() } });
                    }

                    // Dodaj nową sesję
                    let newSession = await client.db("szkolny-copilot").collection("sesje").insertOne({ start_date: new Date(), id_usera: userId, ip_address: req.ip, user_agent: req.headers['user-agent'], ended: false, end_date: null, ended_remotely: false, end_reason: null });
                    
                    req.session.sessionId = newSession.insertedId;
                    req.session.loggedin = true;
                    req.session.login = login;
                    req.session.userId = userId;
                    req.session.ip_address = req.ip;
                    req.session.user_agent = req.headers['user-agent'];
                    
                    req.session.imie = userzy[0].imie;
                    req.session.nazwisko = userzy[0].nazwisko;
                    // req.session.uprawnienia = userzy[0].uprawnienia;
                    // req.session.dostepdo = userzy[0].dostep_do;
                    req.session.szkola = userzy[0].typ_szkoly;
                    req.session.klasa = userzy[0].klasa;
                    // req.session.dziennik = userzy[0].dziennik;

                    res.redirect('/');

                } else {
                    // Więcej niż 1 user z takimi samymi danymi?
                    return;
                }

            } catch (e) {
                console.error(e);
                res.redirect('/auth?error=2');
            } finally {
                await client.close();
            }
        }
    
        connectToDb().catch(console.error);


	} else {

        res.redirect('/auth?error=1');
        res.end();
        return;

        // Later, replace this with a proper error message and CSS
		res.send('Please enter login and Password!');
		res.end();
	}
});

// If 404, redirect to auth
app.use(function(req, res) {
    res.status(404);
    res.redirect('/auth');
});

// io.on("connection", function(socket) {

//     socket.on("user_join", function(data) {
//         this.username = data;
//         socket.broadcast.emit("user_join", data);
//     });

//     socket.on("chat_message", function(data) {
//         data.username = this.username;
//         socket.broadcast.emit("chat_message", data);
//     });

//     socket.on("disconnect", function(data) {
//         socket.broadcast.emit("user_leave", this.username);
//     });
// });

const { handleAiRequest, przedmiotyDropdown, aiModelDropdown, znajdzTemat, saveReport, startup, startChat, updateChatTitle, dzialDropdown, obliczKosztyGenerowaniaTestu, generujTest, zakonczTest, wczytajPoprzedniTest, pptxApi, tematyDialog, obliczKosztyPptx } = require('./chat');

io.on('connection', (socket) => {
    socket.on('message', (message, selectedSubjectId, selectedTopicId, aiModel, chatId) => {
        handleAiRequest(socket, message, selectedSubjectId, selectedTopicId, aiModel, chatId);
    });

    socket.on('przedmiotyDropdown', (message) => {
        przedmiotyDropdown(socket, message);
    });

    socket.on('dzialDropdown', (message, przedmiotId) => {
        dzialDropdown(socket, message, przedmiotId);
    });

    socket.on('aiModelDropdown', (message) => {
        aiModelDropdown(socket, message);
    });

    socket.on('pptxStart', (inputField) => {
        pptxStart(socket, inputField);
    });

    socket.on('znajdzTemat', (przedmiotId, wyszukiwanie) => {
        znajdzTemat(socket, przedmiotId, wyszukiwanie);
    });

    socket.on('tempFunction', () => {
        tempFunction(socket);
    });

    socket.on('sendReport', (reportReason, reportOtherText, wybranyPrzedmiotId, IdWybranegoTematu, aiModel) => {
        saveReport(socket, reportReason, reportOtherText, wybranyPrzedmiotId, IdWybranegoTematu, aiModel);
    })

    socket.on('startup', (functionToLoad) => {
        startup(socket, functionToLoad);
    });

    socket.on('updateChatTitle', (newTitle, chatId) => {
        updateChatTitle(socket, newTitle, chatId);
    });

    socket.on('startChat', (wybranyPrzedmiotId, startNewChat) => {
        startChat(socket, wybranyPrzedmiotId, startNewChat);
    });

    socket.on('hasloreset', (newPassword, oldPassword) => {
        changePassword(socket, newPassword, oldPassword);
    });
    
    socket.on('obliczKosztyGenerowaniaTestu', (modelAi, przedmiot, dzial) => {
        obliczKosztyGenerowaniaTestu(socket, modelAi, przedmiot, dzial);
    });

    socket.on('obliczKosztyPptx', (idPrzedmiotu, wybraneTematy, tematAlternative, aiModel, wiecejInfo) => {
        obliczKosztyPptx(socket, idPrzedmiotu, wybraneTematy, tematAlternative, aiModel, wiecejInfo);
    });

    socket.on('generujTest', (przedmiot, dzial, model) => {
        generujTest(socket, przedmiot, dzial, model);
    });

    socket.on('wczytajPoprzedniTest', (poprzedniTestId) => {
        wczytajPoprzedniTest(socket, poprzedniTestId);
    });

    socket.on('zakonczTest', (wyniki) => {
        zakonczTest(socket, wyniki);
    });

    socket.on('pptxApi', (idPrzedmiotu, wybraneTematy, tematAlternative, aiModel, wiecejInfo) => {
        pptxApi(socket, idPrzedmiotu, wybraneTematy, tematAlternative, aiModel, wiecejInfo);
    });

    socket.on('tematyDialog', (przedmiotId) => {
        tematyDialog(socket, przedmiotId);
    });
});

function changePassword(socket, newPassword, oldPassword) {

    let userId = socket.handshake.session.userId;
    
    const bcrypt = require('bcrypt');
    const saltRounds = 10;

    hashedPass = bcrypt.hashSync(newPassword, saltRounds);

    const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
    const client = new MongoClient(uri);
    const { ObjectId } = new require('mongodb');

    async function connectToDb() {
        try {
            await client.connect();
            let userzy = await client.db("szkolny-copilot").collection("uzytkownicy").find({ _id: new ObjectId(userId) }).toArray();

            if(userzy.length === 1) {
                
                const { ObjectId } = new require('mongodb');
                if(!bcrypt.compareSync(oldPassword, userzy[0].haslo)) {
                    // Hasło nieprawidłowe
                    socket.emit('changePasswordResult', 'Wprowadzone hasło jest nieprawidłowe.');
                    return;
                } else if(bcrypt.compareSync(newPassword, userzy[0].haslo)) {
                    socket.emit('changePasswordResult', 'Nowe hasło nie może być takie samo jak obecne.');
                    return;
                } else if(bcrypt.compareSync(newPassword, userzy[0].poprzednie_haslo)) {
                    socket.emit('changePasswordResult', 'Nowe hasło nie może być takie samo jak poprzednie.');
                    return;
                }

                await client.db("szkolny-copilot").collection("uzytkownicy").updateOne({ _id: new ObjectId(userId) }, { $set: { haslo: hashedPass, poprzednie_haslo: userzy[0].haslo } });
                // let sesje = await client.db("szkolny-copilot").collection("sesje").find({ id_usera: userId, ended: false }).toArray();
                // sesje.forEach(async (sesja) => {
                //     await client.db("szkolny-copilot").collection("sesje").updateOne({ _id: sesja._id }, { $set: { ended: true, end_date: new Date(), ended_remotely: true } });
                // });

                await client.db("szkolny-copilot").collection("sesje").updateMany({ id_usera: userId, ended: false }, { $set: { ended: true, end_date: new Date(), ended_remotely: true, end_reason: 'password_change' } });

                socket.emit('changePasswordResult', true);
                
                // Zaktualizuj datę ostatniego logowania w formacie: 1999-12-31T23:00:00.000+00:00
                await client.db("szkolny-copilot").collection("uzytkownicy").updateOne({ _id: new ObjectId(userId) }, { $set: { data_ostatniego_logowania: new Date() } });
                
                let userIp = socket.handshake.session.ip_address;
                let userAgent = socket.handshake.session.user_agent;

                // Dodaj nową sesję
                let newSession = await client.db("szkolny-copilot").collection("sesje").insertOne({ start_date: new Date(), id_usera: userId, ip_address: userIp, user_agent: userAgent, ended: false, end_date: null, ended_remotely: false });
                
                socket.handshake.session.sessionId = newSession.insertedId;
                socket.handshake.session.loggedin = true;
                socket.handshake.session.login = login;
                socket.handshake.session.userId = userId;
                
                socket.handshake.session.imie = userzy[0].imie;
                socket.handshake.session.nazwisko = userzy[0].nazwisko;
                // req.session.uprawnienia = userzy[0].uprawnienia;
                // req.session.dostepdo = userzy[0].dostep_do;
                socket.handshake.session.szkola = userzy[0].typ_szkoly;
                socket.handshake.session.klasa = userzy[0].klasa;
                // req.session.dziennik = userzy[0].dziennik;

            } else {
                // Więcej niż 1 user z takimi samymi danymi?
                console.error('Nie udało się znaleźć użytkownika podczas zmiany hasła.');
                return;
            }

        } catch (e) {
            console.error(e);
            socket.emit('changePasswordResult', 'Sprawdź poprawność haseł i spróbuj ponownie.');
        } finally {
            await client.close();
        }
    }
    
    connectToDb().catch(console.error);




















}

const { cronFinances, expiredAccess } = require('./cron');

// Every 10 minutes
cron.schedule('*/10 * * * *', () => {
    console.log('Starting cron task...');
    cronFinances();
    expiredAccess();
});

const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    if(input === 'cron-finances') {
        console.log('Starting finances reset cron task... (manual)');
        cronFinances();
    } else if(input === 'cron-access') {
        console.log('Starting expirec access check cron task... (manual)');
        expiredAccess();
    }
});

// ---
// Admin panel

// app.get('/admin', (req, res) => {
//     // Connect to DB and verify user's permissions
//     if(req.session.loggedin && req.session.userId) {


//     const uri = "mongodb+srv://" + process.env.MONGODB_LOGIN + ":" + process.env.MONGODB_PASSWORD + "@" + process.env.MONGODB_CLUSTER + "/?retryWrites=true&w=majority&appName=" + process.env.MONGODB_APPNAME;
//     const client = new MongoClient(uri);

//     async function connectToDb() {
//         try {
//             await client.connect();
//             let userzy = await client.db("szkolny-copilot").collection("uzytkownicy").find({ _id: new ObjectId(req.session.userId) }).toArray();

//             if(userzy.length > 0) {
//                 if(userzy[0].zbanowany === true || userzy[0].uprawnienia !== 'admin') {
//                     // User jest zbanowany
//                     res.redirect('/auth?error=1');
//                     return;
//                 }

//                 res.send('Panel admina');

//             } else {
//                 // Więcej niż 1 user z takimi samymi danymi?
//                 return;
//             }

//         } catch (e) {
//             console.error(e);
//             res.redirect('/auth');
//         } finally {
//             await client.close();
//         }
//     }

//     connectToDb().catch(console.error);
    
//     } else {
//         res.status(404)
//         res.redirect('/auth');
//     }
// });

http.listen(process.env.APP_PORT, () => console.log('App is ready on port ' + process.env.APP_PORT + '!'));

function pptxStart() {
    
}