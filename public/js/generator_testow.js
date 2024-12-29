function isTestDataValid(testData) {
    if(!testData) return 'No test data provided';
    if(!testData.pytania) return 'No questions provided';
    if(testData.pytania.length === 0) return 'No questions provided';
    if(!testData.nazwa_przedmiotu) return 'No subject name provided';
    if(!testData.numer_dzialu) return 'No section number provided';
    if(!testData.nazwa_dzialu) return 'No section name provided';

    for(let i = 0; i < testData.pytania.length; i++) {

        if(!testData.pytania[i].tresc_pytania) return 'No question text provided for question ' + i;
        if(!testData.pytania[i].typ_pytania) return 'No question type provided for question ' + i;
        if(!testData.pytania[i].odpowiedzi) return 'No answers provided for question ' + i;
        if(testData.pytania[i].odpowiedzi.length === 0) return 'No answers provided for question ' + i;
        if(!testData.pytania[i].wyjasnienie_poprawna) return 'No correct answer explanation provided for question ' + i;
        if(!testData.pytania[i].wyjasnienie_bledna) return 'No wrong answer explanation provided for question ' + i;

        for(let j = 0; j < testData.pytania[i].odpowiedzi.length; j++) {
            if(!testData.pytania[i].odpowiedzi[j].tresc_odpowiedzi) return 'No answer text provided for answer ' + j + ' in question ' + i;
            if(!testData.pytania[i].odpowiedzi[j].poprawna) return 'No answer correctness provided for answer ' + j + ' in question ' + i;
        }

        let poprawne = 0;
        for(let j = 0; j < testData.pytania[i].odpowiedzi.length; j++) {
            if(testData.pytania[i].odpowiedzi[j].poprawna === true) poprawne++;
        }
        if(poprawne !== 1) return 'Invalid number of correct answers for question ' + i;
    }

    return true;
}

function startTest() {
    if(!testData) {
        console.error("Brak danych testu");
        return false;
    } else if(!isTestDataValid(testData)) {
        console.error("Nieprawidłowe dane testu");
        return false;
    }

    window.nrPytania = 0;
    window.sumaPytan = testData.pytania.length;
    $('#testName').html('TEST: ' + testData.nazwa_przedmiotu + ' ' + testData.numer_dzialu + ' - ' + testData.nazwa_dzialu);

    $('#screen-main').addClass('hidden');

    $('#screen-test').addClass('flex');
    $('#screen-test').removeClass('hidden');

    // Uruchom interfejs testu
    // Pokaż progressbar
	window.promptToNotClose = true;

    generujPytanie();
}


function generujPytanie() {
    let nrPytania = window.nrPytania;
    $('#answerRes').addClass('hidden');

    // $('#wrongAnswer p').html(testData.pytania[nrPytania].wyjasnienie_bledna);
    // $('#correctAnswer p').html(testData.pytania[nrPytania].wyjasnienie_poprawna);
    $('#questionNumber').html(nrPytania + 1 + '.');
    $('#questionTitle').html(testData.pytania[nrPytania].tresc_pytania);

    $('#progress').css('width', ((nrPytania + 1) / window.sumaPytan) * 100 + '%');
    
    // + Ukryj przycisk podglądu poprawnej odpowiedzi
    // + Jeśli jest to pytanie wielokrotnego wyboru lub pytanie otwarte, zmień treść przycisku na "Sprawdź odpowiedź"

    $('#checkCorrectAnswer').addClass('hidden');
    
    if(testData.pytania[nrPytania].typ_pytania === 'jednokrotnego_wyboru') {
        
        $('#testActionBtn').addClass('hidden');
        $('#testActionBtn').html('<p class="mr-2">Następne pytanie</p><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>');

        let alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
        let odpowiedzHTML = '';

        for(let i = 0; i < testData.pytania[nrPytania].odpowiedzi.length; i++) {

            odpowiedzHTML += '<button id="odp' + i + '" class="answerBtn flex min-w-32 min-h-10 border-2 border-gray-700 rounded-lg text-white text-base select-none p-0 mb-3 hover:bg-gray-850 bg-gray-900 transition duration-150 h-fit w-fit max-w-72" style="width: 220.05px;" onclick="answerClicked(' + i + ')"><div id="odpL' + i + '" class="flex items-center justify-center w-10 aspect-square rounded-l-lg text-white text-xl font-bold">' + alphabet[i] + '</div><div id="odpT' + i + '" class="flex-1 text-start content-center rounded-r-lg text-white border-l-2 px-2.5 border-gray-700 text-wrap h-10"><p>' + testData.pytania[nrPytania].odpowiedzi[i].tresc_odpowiedzi + '</p></div></button>';
        }

        $('#answersDiv').html(odpowiedzHTML);
        
        // $('.answerBtn').css('width', '');
        $('.answerBtn').width('');

        var max = 0;
        $(".answerBtn").each(function() {
            var w = $(this).width();
            if (w > max) {
                max = w;
            }
        });
        $(".answerBtn").width(max);

        window.currentQType = 'jednokrotnego_wyboru';

    }
}

function answerClicked(idOdpowiedzi) {
    if(window.answerShown === true) return;
    console.log('Kliknięto odpowiedź');

    let nrPytania = window.nrPytania;
    let typPytania = window.currentQType;

    if(typPytania === 'jednokrotnego_wyboru') {
        // let idOdpowiedzi = $(this).attr('id').replace('odp', '');
        let poprawna = testData.pytania[nrPytania].odpowiedzi[idOdpowiedzi].poprawna;

        if(poprawna === true) {
            $('#answerRes').css('background', '#004518');
            $('#answerRes div').css('color', '#00d348');
            $('#answerRes p').text(testData.pytania[nrPytania].wyjasnienie_poprawna);
            $('#answerRes #answerResTitle').text('POPRAWNA ODPOWIEDŹ');
            $('#answerRes div #answerResIcon').html('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check leading-normal"><path d="M20 6 9 17l-5-5"/></svg>');

            // Zmień styl przycisku
            $('#odp' + idOdpowiedzi).css('background', '#004518');
            $('#odp' + idOdpowiedzi).css('border', '2px solid #00d348');
            $('#odp' + idOdpowiedzi + ' #odpL' + idOdpowiedzi).css('color', '#00d348');
            $('#odp' + idOdpowiedzi + ' #odpL' + idOdpowiedzi).html('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check leading-normal"><path d="M20 6 9 17l-5-5"/></svg>');
            $('#odp' + idOdpowiedzi + ' #odpT' + idOdpowiedzi).css('border-left', '2px solid #00d348');
            $('#odp' + idOdpowiedzi).addClass('correctAnswerShown');

            let answerInfo = {
                "answer_clicked": idOdpowiedzi,
                "was_correct": true
            };
            testData.pytania[nrPytania].odpowiedz_usera = answerInfo;

        } else {
            $('#answerRes').css('background', '#450000');
            $('#answerRes div').css('color', '#d30000');
            $('#answerRes p').text(testData.pytania[nrPytania].wyjasnienie_bledna);
            $('#answerRes #answerResTitle').text('BŁĘDNA ODPOWIEDŹ');
            $('#answerRes div #answerResIcon').html('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x leading-normal"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>');

            // Zmień styl przycisku
            $('#odp' + idOdpowiedzi).addClass('previousLetter' + $('#odp' + idOdpowiedzi + ' #odpL' + idOdpowiedzi).html());
            $('#odp' + idOdpowiedzi).css('background', '#450000');
            $('#odp' + idOdpowiedzi).css('border', '2px solid #d30000');
            $('#odp' + idOdpowiedzi + ' #odpL' + idOdpowiedzi).css('color', '#d30000');
            $('#odp' + idOdpowiedzi + ' #odpL' + idOdpowiedzi).html('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x leading-normal"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>');
            $('#odp' + idOdpowiedzi + ' #odpT' + idOdpowiedzi).css('border-left', '2px solid #d30000');
            $('#odp' + idOdpowiedzi).addClass('wrongAnswerShown');

            // Add correntAnswerShouldBe class to correct answer
            for(let i = 0; i < testData.pytania[nrPytania].odpowiedzi.length; i++) {
                if(testData.pytania[nrPytania].odpowiedzi[i].poprawna === true) {
                    $('#odp' + i).addClass('correctAnswerShouldBe');
                    $('#odp' + i).addClass('previousLetter' + $('#odp' + i + ' #odpL' + i).html());
                }
            }

            $('#checkCorrectAnswer').removeClass('hidden');

            let answerInfo = {
                "answer_clicked": idOdpowiedzi,
                "was_correct": false
            };
            testData.pytania[nrPytania].odpowiedz_usera = answerInfo;

        }
        
        $('#answerRes').removeClass('hidden');
        $('#testActionBtn').removeClass('hidden');
        $('.answerBtn').addClass('cursor-default');
        $('.answerBtn').removeClass('hover:bg-gray-850');
        window.answerShown = true;

        if(nrPytania + 1 === window.sumaPytan) {
            $('#testActionBtn').html('<p class="mr-2">Zakończ test</p><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>');
        }
    }
};

function testActionBtn() {
    if(window.nrPytania + 1 === window.sumaPytan) {

        // Zakończ test
        updateQuestionsList();
        
        $('#screen-test').addClass('hidden');
        $('#screen-test').removeClass('flex');
        $('#screen-finish').removeClass('hidden');
        $('#screen-finish').addClass('flex');

        let poprawne = 0;
        for(let i = 0; i < testData.pytania.length; i++) {
            if(testData.pytania[i].odpowiedz_usera.was_correct === true) poprawne++;
        }

        let wynik = Math.round((poprawne / testData.pytania.length) * 100);

        setTimeout(() => {
            setRingScore(wynik);
        }, 100);

    } else {
        // Następne pytanie
        $('#checkCorrectAnswer').removeClass('border-gray-500');
        $('#checkCorrectAnswer').removeClass('text-gray-200');
        $('#checkCorrectAnswer').removeClass('bg-gray-800');
        $('#checkCorrectAnswer').removeClass('hover:bg-gray-850');
        $('#checkCorrectAnswer').addClass('border-gray-700');
        $('#checkCorrectAnswer').addClass('text-gray-300');
        $('#checkCorrectAnswer').addClass('bg-gray-900');
        $('#checkCorrectAnswer').addClass('hover:bg-gray-850');
        window.correntAnswerShouldBeShown = false;
        window.answerShown = false;
        window.nrPytania++;
        generujPytanie();
    }
}

function showCorrectAnswer() {
    if(window.answerShown === true && !window.correntAnswerShouldBeShown) {
        $('#answerRes').addClass('hidden');

        $('#checkCorrectAnswer').removeClass('border-gray-700');
        $('#checkCorrectAnswer').removeClass('text-gray-300');
        $('#checkCorrectAnswer').removeClass('bg-gray-900');
        $('#checkCorrectAnswer').removeClass('hover:bg-gray-850');

        $('#checkCorrectAnswer').addClass('border-gray-500');
        $('#checkCorrectAnswer').addClass('text-gray-200');
        $('#checkCorrectAnswer').addClass('bg-gray-800');
        $('#checkCorrectAnswer').addClass('hover:bg-gray-850');

        window.correntAnswerShouldBeShown = true;

        // Get .wrongAnswerShown answer id
        let idOdpowiedziW = $('.wrongAnswerShown').attr('id').replace('odp', '');

        $('.wrongAnswerShown').css('background', '');
        $('.wrongAnswerShown').css('border', '');
        $('.wrongAnswerShown #odpL' + idOdpowiedziW).css('color', '');

        // Przywróć literkę
        $('.wrongAnswerShown #odpL' + idOdpowiedziW).html($('.wrongAnswerShown').attr('class').split(' ').find(e => e.includes('previousLetter')).replace('previousLetter', ''));

        $('.wrongAnswerShown #odpT' + idOdpowiedziW).css('border-left', '');

        // ---

        // Get .correctAnswerShouldBe answer id
        let idOdpowiedziC = $('.correctAnswerShouldBe').attr('id').replace('odp', '');

        // Zmień styl przycisku
        $('.correctAnswerShouldBe').css('background', '#004518');
        $('.correctAnswerShouldBe').css('border', '2px dashed #00d348');
        $('.correctAnswerShouldBe' + ' #odpL' + idOdpowiedziC).css('color', '#00d348');
        $('.correctAnswerShouldBe' + ' #odpL' + idOdpowiedziC).html('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check leading-normal"><path d="M20 6 9 17l-5-5"/></svg>');
        $('.correctAnswerShouldBe' + ' #odpT' + idOdpowiedziC).css('border-left', '2px dashed #00d348');



    } else if(window.answerShown === true && window.correntAnswerShouldBeShown) {
        $('#answerRes').removeClass('hidden');

        $('#checkCorrectAnswer').removeClass('border-gray-500');
        $('#checkCorrectAnswer').removeClass('text-gray-200');
        $('#checkCorrectAnswer').removeClass('bg-gray-800');
        $('#checkCorrectAnswer').removeClass('hover:bg-gray-850');
        $('#checkCorrectAnswer').addClass('border-gray-700');
        $('#checkCorrectAnswer').addClass('text-gray-300');
        $('#checkCorrectAnswer').addClass('bg-gray-900');
        $('#checkCorrectAnswer').addClass('hover:bg-gray-850');

        window.correntAnswerShouldBeShown = false;

        // Get .wrongAnswerShown answer id
        let idOdpowiedziW = $('.wrongAnswerShown').attr('id').replace('odp', '');

        $('.wrongAnswerShown').css('background', '#450000');
        $('.wrongAnswerShown').css('border', '2px solid #d30000');
        $('.wrongAnswerShown' + ' #odpL' + idOdpowiedziW).css('color', '#d30000');
        $('.wrongAnswerShown' + ' #odpL' + idOdpowiedziW).html('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x leading-normal"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>');
        $('.wrongAnswerShown' + ' #odpT' + idOdpowiedziW).css('border-left', '2px solid #d30000');

        // ---

        // Get .correctAnswerShouldBe answer id
        let idOdpowiedziC = $('.correctAnswerShouldBe').attr('id').replace('odp', '');

        // Zmień styl przycisku
        $('.correctAnswerShouldBe').css('background', '');
        $('.correctAnswerShouldBe').css('border', '');
        $('.correctAnswerShouldBe' + ' #odpL' + idOdpowiedziC).css('color', '');
        $('.correctAnswerShouldBe' + ' #odpL' + idOdpowiedziC).html($('.correctAnswerShouldBe').attr('class').split(' ').find(e => e.includes('previousLetter')).replace('previousLetter', ''));
        $('.correctAnswerShouldBe' + ' #odpT' + idOdpowiedziC).css('border-left', '');
    }
}

var $circle = $('#progress-ring-circle');
var $text = $('#progress-text');
var radius = $circle[0].r.baseVal.value;
var circumference = radius * 2 * Math.PI;

$circle.css('strokeDasharray', `${circumference} ${circumference}`);
$circle.css('strokeDashoffset', `${circumference}`);

function setRingScore(percent) {
    const offset = circumference - percent / 100 * circumference;
    $circle.css('strokeDashoffset', offset);
    $text.text(`${percent}%`);

    console.log(percent);

    if (percent < 25) {
        $circle.css('stroke', '#e02424');
        $text.css('fill', '#e02424');
    } else if (percent >= 25 && percent <= 35) {
        $circle.css('stroke', '#f59e0b');
        $text.css('fill', '#f59e0b');
    } else {
        $circle.css('stroke', '#0e9f6e');
        $text.css('fill', '#0e9f6e');
    }
}

function updateQuestionsList() {
    if(window.nrPytania + 1 === window.sumaPytan) {
		// Zakończ test
        for(let i = 0; i < testData.pytania.length; i++) {
            let pytanie = testData.pytania[i];
            let odp = pytanie.odpowiedz_usera;

            if(odp.was_correct === true) {
                $('#qListDiv').append(`<div class="qListElement w-full border-b border-gray-800 pb-4 mt-4">
                    <div class="flex flex-row w-full items-center">
                        <div class="mr-2 p-0.5 rounded" style="background: #004518"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d348" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check leading-normal"><path d="M20 6 9 17l-5-5"/></svg></div>
                        <p>${i+1}. ${pytanie.tresc_pytania}</p>
                        
                        <div class="flex-1"></div>

                        <!-- Dropdown -->
                        <button id="toggleAo${i}" class="border-2 border-gray-700 rounded-lg text-gray-300 text-base select-none p-0.5 transition duration-150 bg-gray-900 hover:bg-gray-850" onclick="toggleMoreInfo(${i})"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><polyline points="6 9 12 15 18 9"/></svg></button>
                    </div>

                    <div id="aoMoreInfo${i}" class="aoMoreInfo hidden mt-2">
                        W tym pytaniu wskazano poprawną odpowiedź - ${odp.answer_clicked+1}. ${pytanie.odpowiedzi[odp.answer_clicked].tresc_odpowiedzi}. <br>
                        ${pytanie.wyjasnienie_poprawna}
                    </div>
                </div>`);
            } else {
                $('#qListDiv').append(`<div class="qListElement w-full border-b border-gray-800 pb-4 mt-4">
                    <div class="flex flex-row w-full items-center">
                        <div class="mr-2 p-0.5 rounded" style="background: #450000"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d30000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x leading-normal"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></div>
                        <p>${pytanie.tresc_pytania}</p>
                        
                        <div class="flex-1"></div>

                        <!-- Dropdown -->
                        <button id="toggleAo${i}" class="border-2 border-gray-700 rounded-lg text-gray-300 text-base select-none p-0.5 transition duration-150 bg-gray-900 hover:bg-gray-850" onclick="toggleMoreInfo(${i})"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><polyline points="6 9 12 15 18 9"/></svg></button>
                    </div>

                    <div id="aoMoreInfo${i}" class="aoMoreInfo hidden mt-2">
                        W tym pytaniu niestety nie udało Ci się wskazać dobrego rozwiązania.<br>
                        Zaznaczona odpowiedź to ${odp.answer_clicked+1}. ${pytanie.odpowiedzi[odp.answer_clicked].tresc_odpowiedzi}.<br>
                        Poprawną odpowiedzią na to pytanie jest: ${pytanie.odpowiedzi.find(e => e.poprawna === true).tresc_odpowiedzi}.<br>
                        <br>
                        Wyjaśnienie:<br>
                        ${pytanie.wyjasnienie_bledna}
                    </div>
                </div>`);
            }

        }

		socket.emit('zakonczTest', testData);
    }
}

function generateTest() {
	window.promptToNotClose = true;
    $('#screen-main').addClass('hidden');
    $('#screen-loading').removeClass('hidden');
    $('#screen-loading').addClass('flex');

	let przedmiot = window.wybranyPrzedmiotId;
	let dzial = window.wybranyDzial;
	let model = window.wybranyModel;

	socket.emit('generujTest', przedmiot, dzial, model);
	console.log('Generuję test');
}

// Skrypt startup
// Jest div o id previousTestNotFinished, który ma być normalnie hidden, a ma się pokazać, jak przy statupie wykryje, że został utworzony nowy test, ale nie został zakończony
// Jest przycisk o id loadPreviousTestBtn i po kliknięciu na niego wywołuj funkcję loadPreviousTestBtn()
// Chcę, żeby po kliknięciu przycisku zmienił się jego background na szary i żeby się pokazał "apple loader" tak jak jest to przy zmianie hasła

socket.emit('startup', 'generator_testow');

let startupTry = 0;
socket.on('startup', function(response, aiModel, poprzedniTest) {
    if(response === 'auth-redirection') {
        window.location.href = '/logout';
    } else if(response === 'db-err') {
        
        // Retry
        if(startupTry < 3) {
            startupTry++;
            socket.emit('startup', 'generator_testow');
        } else {
            // Nie udało się połączyć z bazą danych
            // Odśwież stronę
            window.location.reload();
        }
    } else if(response === 'banned') {
        window.location.href = '/';

    } else if(response === 'success' && aiModel) {

        if(poprzedniTest) {
            $('#previousTestNotFinished').removeClass('hidden');
            $('#creatingNewTest').removeClass('flex');
            $('#creatingNewTest').addClass('hidden');
            $('#loadPreviousTestBtn').prop('disabled', false);
            window.previousTestId = poprzedniTest;
        }

        $('#wybierzModel').html(aiModel.nazwa_wyswietlana + ' <i class="fa-solid fa-chevron-down ms-2"></i>');
        window.wybranyModel = aiModel.nazwa_modelu;

    } else {
        // console.log('Startup failed - unknown error');
        window.location.href = '/';
    }

});

$('#wybierzPrzedmiot').on('click', function() {
    socket.emit('przedmiotyDropdown', 'generator_testow');
});

socket.on('przedmiotyDropdown', function(sendHtml) {
    $('#przedmiotList').html(sendHtml);
});

$('#przedmiotList').on('click', 'li', function() {
    const wybranyPrzedmiot = $(this).find('a').text();
    const wybranyPrzedmiotId = $(this).find('span').text();
    window.wybranyPrzedmiotId = wybranyPrzedmiotId;

    $('#wybierzPrzedmiot').html(wybranyPrzedmiot + '<i class="fa-solid fa-chevron-down ms-2"></i>');
    $('#dropdownPrzedmiot').removeClass('block').addClass('hidden');

    $('#createStep2').removeClass('hidden');

    // Resetuj dropdown z działami
    $('#wybierzDzial').html('Wybierz dział<i class="fa-solid fa-chevron-down ms-2"></i>');
    $('#dzialList').html(`<div class="flex flex-col items-center justify-center min-h-fit max-h-24 overflow-auto p-4">
                        <svg class="loadingSpinner z-20 text-center size-12" viewBox="0 0 50 50">
                            <circle class="spinnerPath stroke-gray-400 dark:stroke-gray-300" cx="25" cy="25" r="20" fill="none" stroke-width="2"></circle>
                        </svg>
                    </div>`);
    $('#createStep3').addClass('hidden');
    $('#startGeneratingTest').removeClass('flex').addClass('hidden');
});

// ---

$('#wybierzDzial').on('click', function() {
    socket.emit('dzialDropdown', 'generator_testow', window.wybranyPrzedmiotId);
});

socket.on('dzialDropdown', function(sendHtml) {
    $('#dzialList').html(sendHtml);
});

$('#dzialList').on('click', 'li', function() {
    const wybranyDzialText = $(this).find('a').text().split('(')[0];
    const wybranyNumerDzialu = $(this).find('span').text();
    window.wybranyDzial = wybranyNumerDzialu;

    $('#wybierzDzial').html(wybranyDzialText + '<i class="fa-solid fa-chevron-down ms-2"></i>');
    $('#dropdownDzial').removeClass('block').addClass('hidden');

    $('#createStep3').removeClass('hidden');
    $('#startGeneratingTest').removeClass('hidden').addClass('flex');

    $('#startGeneratingTestBtn').prop('disabled', true);
    obliczKosztyGenerowaniaTestu();
});

// ---

$('#wybierzModel').on('click', function() {
    socket.emit('aiModelDropdown', 'generator_testow');
});

socket.on('aiModelDropdown', function(sendHtml) {
    $('#modelList').html(sendHtml);
});

$('#modelList').on('click', 'li', function() {
    const wybranyModel = $(this).find('a').text().split('(')[0];
    const wybranyModelId = $(this).find('span').text();
    window.wybranyModel = wybranyModelId;

    $('#wybierzModel').html(wybranyModel + '<i class="fa-solid fa-chevron-down ms-2"></i>');
    $('#dropdownModel').removeClass('block').addClass('hidden');

    $('#startGeneratingTestBtn').prop('disabled', true);
    obliczKosztyGenerowaniaTestu();
});

// ---

function obliczKosztyGenerowaniaTestu() {
    $('#predictedPrice').html('---');
    socket.emit('obliczKosztyGenerowaniaTestu', window.wybranyModel, window.wybranyPrzedmiotId, window.wybranyDzial);
}

socket.on('obliczKosztyGenerowaniaTestu', function(cena) {
    $('#startGeneratingTestBtn').prop('disabled', false);
    $('#predictedPrice').html(cena);
});

socket.on('generujTest', function(response, wygenerowanePytania) {
	if(response === 'success') {
		testData = wygenerowanePytania;
		$('#screen-loading').addClass('hidden').removeClass('flex');
		startTest();
	} else {
		console.error('Nie udało się wygenerować testu');
		$('#screen-loading').addClass('hidden').removeClass('flex');
		$('#screen-failed').addClass('flex').removeClass('hidden');
		$('#failed-moreinfo').html('Nie udało się wygenerować testu. Odśwież stronę i spróbuj ponownie, a jeśli problem nadal występuje skontaktuj się z administratorem serwisu.');
	}
});

socket.on('wczytajPoprzedniTest', function(response, poprzedniePytania) {
	if(response === 'success') {
		testData = poprzedniePytania;
		$('#screen-loading').addClass('hidden').removeClass('flex');
		startTest();
	} else {
		console.error('Nie udało się wczytać poprzedniego testu');
		$('#screen-loading').addClass('hidden').removeClass('flex');
		$('#screen-failed').addClass('flex').removeClass('hidden');
		$('#failed-moreinfo').html('Nie udało się pobrać informacji o ostatnim wygenerowanym teście. Odśwież stronę i spróbuj ponownie, a jeśli problem nadal występuje skontaktuj się z administratorem serwisu.');
	}
});

function wczytajPoprzedniTest() {
	window.promptToNotClose = true;
	$('#screen-main').addClass('hidden');
	$('#progressAnimation').addClass('hidden');
	$('#screen-loading').removeClass('hidden');
	$('#screen-loading').addClass('flex');
	$('#screen-loading h2').html('Wczytuję poprzedni test...');
	$('#screen-loading div > p').html('Potrwa to tylko kilka sekund');

	socket.emit('wczytajPoprzedniTest', window.previousTestId);
}

socket.on('zakonczTest', function(response) {
	window.promptToNotClose = false;
});

window.onbeforeunload = function() {
	if(window.promptToNotClose) {
		return "Czy na pewno chcesz opuścić stronę? Niezapisane postępy testu zostaną utracone.";
	}
};