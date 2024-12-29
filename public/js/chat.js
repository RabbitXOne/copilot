// const { type } = require("jquery");

// Wysyłanie wiadomości

// Liczenie czasu od wysłania wiadomości do otrzymania odpowiedzi
let time = 0;
let intervalId = null;

function startTimer() {
    intervalId = setInterval(() => {
        time += 0.1;
        timeDiv.text(time.toFixed(1) + 's');
    }, 100);
}

function stopTimer() {
    clearInterval(intervalId);
}

let messageHistory = [];

sendMessageButton.on('click', function() {
    if (typeMessage.val().length >= 3 && typeMessage.prop('disabled') !== true) {
        typeMessage.prop('disabled', true);
        sendMessageButton.prop('disabled', true);

        bookSelectOpen.removeClass('cursor-pointer');
        bookSelectOpen.addClass('cursor-not-allowed');
        loadingBar.removeClass('hidden');
        requestTimer.removeClass('hidden');

        let message = typeMessage.val();
        let selectedSubjectId = window.wybranyPrzedmiotId;
        var selectedTopicId = null;

        window.chatAlreadyStarted = true;
        $('#chatAlreadyStarted').removeClass('hidden');
        $('#chatAlreadyStarted').addClass('flex');
        $('#wybierzModelAI').prop('disabled', true);

        if(window.wybranyTemat) {
            selectedTopicId = window.wybranyTemat.id;
        }

        let aiModel = window.aiModel;
        let chatId = window.chatId;

        if(selectedTopicId !== null) {
            messageHistory.push({
                "role": "user",
                "message": message,
                "source": window.wybranyTemat.tytul + ', str. ' + window.wybranyTemat.strona
            });
        } else {
            messageHistory.push({
                "role": "user",
                "message": message
            });
        }

        updateChatBox();

        socket.emit('message', message, selectedSubjectId, selectedTopicId, aiModel, chatId);
        startTimer();
    }
});

function updateChatBox() {

    // Accepted JSON schema:
    // {
        //      "role": "user" | "model",
        //      "message": "message",
        //      "sent": false (only works for user message, will show "retry" button),
        //      "source": "content" (only works for user message, will show additional source information above the message)
        // }
        
    let setChatboxHtml = '';
    for (let message of messageHistory) {
        var converter = new showdown.Converter(),
            text      = message.message,
            formatted      = converter.makeHtml(text);

            formatted = formatted.replace(/<\/?p[^>]*>/g, "");
        
        if (message.role ===  "user") {

            if(message.source) {
                setChatboxHtml = setChatboxHtml + '<div class="usermsg rounded bg-orange-500 dark:bg-violet-700 w-4/5 max-w-fit h-fit p-2 m-2 self-end shadow-md"><p class="text-xs font-extralight text-white dark:text-gray-200 text-end select-none"><i class="fa-solid fa-book mr-1"></i>W oparciu o: <span>' + message.source + '</span></p><p class="text-sm font-light text-white text-end">' + formatted + "</p></div>";
            } else {
                setChatboxHtml = setChatboxHtml + '<div class="usermsg rounded bg-orange-500 dark:bg-violet-700 dark:text-gray-200 w-4/5 max-w-fit h-fit p-2 m-2 self-end shadow-md"><p class="text-sm font-light text-white text-end">' + formatted + "</p></div>";
            }
        } else {
            setChatboxHtml = setChatboxHtml + '<div class="modelmsg rounded dark:bg-gray-800 bg-gray-200 w-4/5 max-w-fit h-fit p-2 m-2 self-start shadow-md"><p class="text-sm font-light text-gray-900 dark:text-white text-start">' + formatted + "</p></div>";
        }
    }

    if (typeof chatMessages !== 'undefined') {
        chatMessages.html(setChatboxHtml);
    } else {
        console.error('chatMessages is not defined');
    }
}

socket.on('successfulRequest', function(modelAnswer) {
    typeMessage.val('');
    loadingBar.addClass('hidden');
    requestTimer.addClass('hidden');
    bookSelectOpen.removeClass('cursor-not-allowed');
    bookSelectOpen.addClass('cursor-pointer');
    bsoTop.html('<i class="fa-solid fa-angle-up mr-2"></i><span>Wybierz fragment z podręcznika</span>');
    bookSelectOpen.removeClass('bso-anim');
    window.wybranyTemat = null;
    
    messageHistory.push({
        "role": "model",
        "message": modelAnswer,
    });
    updateChatBox();

    stopTimer();
    typeMessage.prop('disabled', false);
    sendMessageButton.prop('disabled', typeMessage.val().length < 3);
    time = 0;
});

socket.on('requestError', function(apiErrorMsg) {
    typeMessage.val('');
    loadingBar.addClass('hidden');
    requestTimer.addClass('hidden');
    errorDiv.removeClass('fadeOut');
    errorDiv.addClass('fadeIn');
    errorDiv.removeClass('hidden');
    errorContent.html(apiErrorMsg);
    stopTimer();

    typeMessage.prop('disabled', false);
    sendMessageButton.prop('disabled', typeMessage.val().length < 3);

    if(apiErrorMsg === 'Sesja wygasła. Zaloguj się ponownie.') {
        setTimeout(function() {
            window.location.href = '/auth';
        }, 4000);
    } else if(apiErrorMsg === 'To konto nie ma uprawnień do korzystania z tej funkcji.') {
        setTimeout(function() {
            window.location.href = '/';
        }, 4000);
    }

    setTimeout(function() {
        errorDiv.removeClass('fadeIn');
        errorDiv.addClass('fadeOut');
        
        setTimeout(function() {
            errorDiv.addClass('hidden');
        }, 150);

    }, 10000);
});

// ---

$('#wybierzPrzedmiotStart').on('click', function() {
    socket.emit('przedmiotyDropdown');
});

socket.on('przedmiotyDropdown', function(sendHtml) {
    $('#dropdownPrzedmiotStartList').html(sendHtml);
});

$('#dropdownPrzedmiotStartList').on('click', 'li', function() {
    const wybranyPrzedmiot = $(this).find('a').text();
    window.wybranyPrzedmiot = wybranyPrzedmiot;

    $('#wybierzPrzedmiotStart').html(wybranyPrzedmiot + '<i class="fa-solid fa-chevron-down ms-2"></i>');
    $('#dropdownPrzedmiotStart').removeClass('block').addClass('hidden');
    $('#startChatBtn').prop('disabled', false);

    // Pobieranie ID przedmiotu
    const wybranyPrzedmiotId = $(this).find('span').text();
    window.wybranyPrzedmiotId = wybranyPrzedmiotId;

    $('#wybranyPrzedmiot').html(wybranyPrzedmiot + '<i class="fa-solid fa-chevron-down ms-2"></i>');
    $('#chatTitle').val('Czat z AI - ' + wybranyPrzedmiot);
});

$('#startChatBtn').on('click', function() {

    $('#startChatBtn').prop('disabled', true);
    $('#startScreenLoading').removeClass('hidden');
    $('#wybierzPrzedmiotStart').prop('disabled', true);

    // If URL contains 'newChat' parameter, start new chat
    let startNewChat = false;
    if(window.location.href.indexOf('newChat') > -1) {
        startNewChat = true;
    }

    socket.emit('startChat', window.wybranyPrzedmiotId, startNewChat);

    if(startNewChat) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
});

socket.on('startChat', function(chatId, supportsRAG, isOldChat, setChatboxHtml, chatTitle) {

    console.log(isOldChat);

    if(setChatboxHtml) {
        chatMessages.html(setChatboxHtml);
        $('#chatTitle').val(chatTitle);
    }

    if(isOldChat) {
        $('#chatAlreadyStarted').removeClass('hidden');
        $('#chatAlreadyStarted').addClass('flex');
    }

    let canUseRag = window.rag;
    let canUseInternet = window.internet;

    if(canUseRag && supportsRAG === true) {  
        $('#functionSwitches').append(`<label id="useRAGcontainer" class="checkContainer block relative pl-9 mb-3 cursor-pointer text-sm select-none text-gray-500 dark:text-gray-400 text-wrap max-w-40">Wykorzystuj treści z podręczników (RAG)
                    <input id="useRAG" type="checkbox" class="absolute opacity-0 cursor-pointer h-0 w-0 rounded-md">
                    <span class="checkmark absolute top-0 left-0 h-6 w-6 bg-gray-100 dark:bg-gray-800 rounded-md transition duration-150"></span>
                </label>`);
    } else if(canUseRag && supportsRAG === false) {
        $('#functionSwitches').append(`<label id="useRAGcontainer" data-tooltip-target="tooltip-rag-unsupported" class="checkContainer block relative pl-9 mb-3 cursor-pointer text-sm select-none text-gray-500 dark:text-gray-400 text-wrap max-w-40">Wykorzystuj treści z podręczników (RAG)
                    <input id="useRAG" type="checkbox" class="absolute opacity-0 cursor-pointer h-0 w-0 rounded-md" disabled>
                    <span class="checkmark absolute top-0 left-0 h-6 w-6 bg-gray-100 dark:bg-gray-800 rounded-md transition duration-150"></span>
                </label>
                <div id="tooltip-rag-unsupported" role="tooltip" class="absolute z-10 invisible inline-block px-3 py-2 text-sm font-medium text-white dark:text-gray-300 transition-opacity duration-300 bg-gray-900 rounded-md shadow-sm opacity-0 tooltip dark:bg-gray-800 max-w-52">Wybrany przedmiot nie wspiera tej funkcji<div class="tooltip-arrow" data-popper-arrow></div></div>`);
    }

    if(canUseInternet) {
        $('#functionSwitches').append(`<label id="useInternetcontainer" class="checkContainer block relative pl-9 mb-3 cursor-pointer text-sm select-none text-gray-500 dark:text-gray-400 text-wrap max-w-40">Zezwól na wyszukiwanie treści w Internecie
                    <input id="useInternet" type="checkbox" class="absolute opacity-0 cursor-pointer h-0 w-0 rounded-md">
                    <span class="checkmark absolute top-0 left-0 h-6 w-6 bg-gray-100 dark:bg-gray-800 rounded-md transition duration-150"></span>
                </label>`);
    }
    
    window.chatId = chatId;
    $('#startScreen').css('animation', 'closeModal 0.2s ease-in-out');
    
    setTimeout(function() {
        $('#startScreen').addClass('hidden');
        $('#chatScreen').css('animation', '');
    }, 190);
});


$('#wybierzModelAi').on('click', function() {
    socket.emit('aiModelDropdown');
});

socket.on('aiModelDropdown', function(sendHtml) {
    $('#modelAIlist').html(sendHtml);
});

$('#modelAIlist').on('click', 'li', function() {
    const wybranyModel = $(this).find('a').text();
    const wybranyModelId = $(this).find('span').text();
    window.aiModel = wybranyModelId;

    $('#wybierzModelAi').html(wybranyModel + '<i class="fa-solid fa-chevron-down ms-2"></i>');
    $('#dropdownModelAI').removeClass('block').addClass('hidden');
});



// Wyszukiwanie książki
let timeout = null;

typeMessage.on('input', function() {
    clearTimeout(timeout); // Anuluj poprzedni timeout niezależnie od stanu

    if (typeMessage.val().trim() === '') {
        
    } else if (bookSelect.css('display') !== 'none' && typeMessage.prop('placeholder') === 'Wyszukaj fragment książki...') {
        timeout = setTimeout(searchRequest, 500);
    }
});

function searchRequest() {
    console.log('Wysyłanie zapytania...');
}

$(window).on('resize', function() {
    var typeMessageWidth = typeMessage.outerWidth();
    bookSelect.css('width', typeMessageWidth + 'px');
    bookSelectContainer.css('width', typeMessageWidth + 'px');
});

// Otwieranie/zamykanie okna z wyborem książki
bookSelectOpen.on('click', function(event) {
    event.stopPropagation(); // Prevents the document click listener from firing

    var typeMessageWidth = typeMessage.outerWidth();
    bookSelect.css('width', typeMessageWidth + 'px');
    bookSelectContainer.css('width', typeMessageWidth + 'px');
    
    if (bookSelect.css('display') === 'none' && bookSelectContainer.css('display') === 'none' && loadingBar.css('display') === 'none' && requestTimer.css('display') === 'none' && window.wybranyPrzedmiot && typeMessage.prop('disabled') !== true) {
        bsLoading.addClass('hidden');
        bsResults.addClass('hidden');
        bsNothingFound.addClass('hidden');
        bsType.removeClass('hidden');

        bookSelectContainer.css('display', 'block');
        bookSelect.css('animation', 'bookSelectShow 0.2s ease-in-out');
        bookSelect.css('display', 'block');

        setTimeout(function() {
            typeMessage.oldInputValue = typeMessage.val();
            typeMessage.prop('placeholder', 'Wyszukaj fragment książki...');
            typeMessage.val(''); // Clear the input field
            sendMessageButton.prop('disabled', true); // Disable the send button
        }, 100);

        setTimeout(function() {
            bookSelect.css('animation', '');
        }, 190);

    } else if(bookSelect.css('display') === 'block' && bookSelectContainer.css('display') === 'block') {
        bookSelect.css('animation', 'bookSelectHide 0.2s ease-in-out');

        setTimeout(function() {
            typeMessage.prop('placeholder', 'Wpisz polecenie...'); // Restore the old placeholder
            typeMessage.val(typeMessage.oldInputValue); // Restore the old input value
        }, 100);
        
        setTimeout(function() {
            bookSelect.css('animation', '');
            bookSelect.css('display', 'none');
            bookSelectContainer.css('display', 'none');
            sendMessageButton.prop('disabled', typeMessage.val().length < 3);
        }, 190);
    }
});

// $('#startScreen').addClass('hidden');

// Zamykanie okna z wyborem książki po kliknięciu poza nim
$(document).on('click', function(event) {
    var isClickInside = bookSelect.has(event.target).length > 0 || bookSelectOpen.has(event.target).length > 0 || typeMessage.has(event.target).length > 0;

    if (!isClickInside && bookSelect.css('display') === 'block' && bookSelectContainer.css('display') === 'block' && event.target.id !== 'typeMessage') {
        bookSelect.css('animation', 'bookSelectHide 0.2s ease-in-out');

        setTimeout(function() {
            typeMessage.prop('placeholder', 'Wpisz polecenie...'); // Restore the old placeholder
            typeMessage.val(typeMessage.oldInputValue); // Restore the old input value
        }, 100);
        
        setTimeout(function() {
            bookSelect.css('animation', '');
            bookSelect.css('display', 'none');
            bookSelectContainer.css('display', 'none');
        }, 190);

        sendMessageButton.prop('disabled', typeMessage.val().length < 3);
    }
});

// Zamykanie okna z wyborem książki po naciśnięciu klawisza Escape
$(document).on('keydown', function(event) {
    if (event.key === 'Escape' && bookSelect.css('display') === 'block') {
        bookSelect.css('animation', 'bookSelectHide 0.2s ease-in-out');

        setTimeout(function() {
            typeMessage.prop('placeholder', 'Wpisz polecenie...'); // Restore the old placeholder
            typeMessage.val(typeMessage.oldInputValue); // Restore the old input value
        }, 100);
        
        setTimeout(function() {
            bookSelect.css('animation', '');
            bookSelect.css('display', 'none');
            bookSelectContainer.css('display', 'none');
            sendMessageButton.prop('disabled', typeMessage.val().length < 3);
        }, 190);
    }
});

// Zezwól na wysłanie wiadomości, jeśli pole wpisywania ma co najmniej 3 znaki i okno z wyborem książki jest zamknięte
typeMessage.on('input', function() {
    // Wyjątek: same spacje nie są liczone
    if (typeMessage.val().trim().length === 0) {
        typeMessage.val('');
    }
    
    sendMessageButton.prop('disabled', typeMessage.val().length < 3 || bookSelect.css('display') === 'block');
});

let searchRequestTimeout = null;

// Wyszukiwanie książki
typeMessage.on('input', function() {
    clearTimeout(searchRequestTimeout); // Anuluj poprzedni timeout niezależnie od stanu

    if (typeMessage.val().trim() === '') {
        searchRequestTimeout = null; // Wyzeruj timeout jeśli pole jest puste
        bsNothingFound.addClass('hidden');
        bsResults.addClass('hidden');
        bsLoading.addClass('hidden');
        bsType.removeClass('hidden');
    } else if (bookSelect.css('display') !== 'none' && typeMessage.prop('placeholder') === 'Wyszukaj fragment książki...') {
        searchRequestTimeout = setTimeout(searchRequest, 500);
    }
});

function searchRequest() {

    bsNothingFound.addClass('hidden');
    bsResults.addClass('hidden');
    bsType.addClass('hidden');
    bsLoading.removeClass('hidden');

    let przedmiotId = window.wybranyPrzedmiotId;
    let wyszukiwanie = typeMessage.val();

    socket.emit('znajdzTemat', przedmiotId, wyszukiwanie);

}

socket.on('wyszukanoTematy', function(sendHtml) {
    bsLoading.addClass('hidden');
    bsNothingFound.addClass('hidden');
    bsType.addClass('hidden');
    bsResults.removeClass('hidden');
    bsResults.html(sendHtml);
});

socket.on('nicNieZnaleziono', function() {
    bsLoading.addClass('hidden');
    bsResults.addClass('hidden');
    bsType.addClass('hidden');
    bsNothingFound.removeClass('hidden');
});


function selectBook(event) {
    event.stopPropagation(); // Prevents the document click listener from firing

    const bsrTytulTematu = $(event.currentTarget).find('.bs--tytultematu').html();
    // const bsrNazwaPrzedmiotu = $(event.currentTarget).find('.bs--nazwaprzedmiotu').text();
    const bsrStrona = $(event.currentTarget).find('.bs--strona').text();
    const bsrIdTematu = $(event.currentTarget).find('.bs--idtematu').text();

    window.wybranyTemat = {
        "id": bsrIdTematu,
        "tytul": bsrTytulTematu,
        "strona": bsrStrona
    };

    bookSelect.css('animation', 'bookSelectHide 0.2s ease-in-out');
    bsoTop.html('<i class="fa-solid fa-book-open mr-2"></i><span>Na podstawie: ' + bsrTytulTematu + ' - (' + bsrStrona + ')</span>');
    bookSelectOpen.addClass('bso-anim');

    setTimeout(function() {
        typeMessage.prop('placeholder', 'Wpisz polecenie...');
        typeMessage.val('');
    }, 100);

    setTimeout(function() {
        bookSelect.css('animation', '');
        bookSelect.css('display', 'none');
        bookSelectContainer.css('display', 'none');
        bsLoading.addClass('hidden');
        bsResults.addClass('hidden');
        bsNothingFound.addClass('hidden');
        bsType.removeClass('hidden');
        sendMessageButton.prop('disabled', typeMessage.val().length < 3);
    }, 190);


    

}

// informacja, że przeglądarka jest nieobsługiwana, bo nie może się wykonać kod js

$(document).ready(function() {
    $('[data-dropdown-toggle]').on('click', function() {
        var dropdownDiv = $(this).attr('data-dropdown-toggle');
        if($('#' + dropdownDiv).is(':visible')) {
            $('#' + dropdownDiv).css('animation', 'fadeOut 0.2s ease-in-out');
            setTimeout(function() {
                $('#' + dropdownDiv).css('animation', '');
            }, 190);

        } else {
            $('#' + dropdownDiv).css('animation', 'fadeIn 0.2s ease-in-out');
            setTimeout(function() {
                $('#' + dropdownDiv).css('animation', '');
            }, 190);
        }
    });
});

$('#reportReasons').on('click', 'input', function() {
    if($(this).is(':checked') && !$(this).is('#reportOther')) {
        $('#sendReport').prop('disabled', false);
        $('#reportOtherText').addClass('hidden');
    } else if($('#reportOther').is(':checked')) {
        $('#sendReport').prop('disabled', true);
        $('#reportOtherText').removeClass('hidden');
    } else {
        $('#sendReport').prop('disabled', true);
        $('#reportOtherText').addClass('hidden');
    }
});

$('#reportOtherText').on('input', function() {
    if($('#reportOther').is(':checked') && $('#reportOtherText').val().length >= 3) {
        $('#sendReport').prop('disabled', false);
    } else {
        $('#sendReport').prop('disabled', true);
    }
});

function toggleModal() {
    if($('#modalContainer').hasClass('hidden')) {
        $('#modalContainer').removeClass('hidden');
        $('#modalContainer').addClass('flex');
        $('#modalContainer').css('animation', 'fadeIn 0.2s ease-out');

        $('#modalBox').removeClass('hidden');
        $('#modalBox').css('animation', 'openModal 0.2s ease-out');

        setTimeout(function() {
            $('#modalContainer').css('animation', '');
            $('#modalBox').css('animation', '');
        }, 190);
    } else {
        $('#modalContainer').css('animation', 'fadeOut 0.2s ease-in-out');
        $('#modalBox').css('animation', 'closeModal 0.2s ease-in-out');
    
        setTimeout(function() {
            $('#modalContainer').addClass('hidden');
            $('#modalContainer').removeClass('flex');
            $('#modalBox').addClass('hidden');
            $('#modalContainer').css('animation', '');
            $('#modalBox').css('animation', '');
        }, 190);
    }
}

function sendReport() {
    var reportReason = $('#reportReasons input:checked').val();
    var reportOtherText = $('#reportOtherText').val();
    var aiModel = window.aiModel;

    $('#reportReasons input').prop('disabled', true);
    $('#sendReport').prop('disabled', true);
    $('#reportOtherText').prop('disabled', true);
    $('#sendingReport').removeClass('hidden');

    const wybranyPrzedmiotId = window.wybranyPrzedmiotId;
    var wybranyTemat = null;

    if(window.wybranyTemat) {
        wybranyTemat = window.wybranyTemat;
    }

    console.log('Sending report...');

    socket.emit('sendReport', reportReason, reportOtherText, wybranyPrzedmiotId, wybranyTemat, aiModel);
}

socket.on('reportSentSuccessfully', function() {
    $('#sendingReport').addClass('hidden');
    $('reportOtherText').prop('disabled', false);
    $('#sendReport').prop('disabled', false);
    $('reportOtherText').val('');

    setTimeout(function() {
        toggleModal();
    }, 500);
});

socket.on('reportNotSent', function() {
    $('#sendingReport').addClass('hidden');
    const reportPrivacyNotice = $('#reportPrivacyNotice');

    reportPrivacyNotice.removeClass('text-gray-700');
    reportPrivacyNotice.removeClass('border-gray-700');
    reportPrivacyNotice.removeClass('bg-gray-300');

    reportPrivacyNotice.addClass('text-red-900');
    reportPrivacyNotice.addClass('border-red-600');
    reportPrivacyNotice.addClass('bg-red-400');

    $('#reportPrivacyNotice i').removeClass('fa-info-circle');
    $('#reportPrivacyNotice i').addClass('fa-exclamation-triangle');
    $('#reportPrivacyNotice p').html('Zgłoszenie błędu nie zostało wysłane, ponieważ nie udało się połączyć z bazą danych.')

    $('#reportReasons input').prop('disabled', false);
    $('#sendReport').prop('disabled', false);
    $('reportOtherText').prop('disabled', false);
});

let startupTry = 0;
socket.on('startup', function(response, additionalData1, additionalData2) {
    // console.log('Startup event received');
    console.log(response);

    if(response === 'auth-redirection') {
        window.location.href = '/logout';
    } else if(response === 'db-err') {
        
        // Retry
        if(startupTry < 3) {
            startupTry++;
            socket.emit('startup', 'chat');
        } else {
            // Nie udało się połączyć z bazą danych
            window.location.href = '/';
        }
    } else if(response === 'banned') {
        // Zbanowany
        window.location.href = '/';
        
    } else if(response === 'cost-limit-exceeded') {
        // Użytkownik osiągnął tygodniowy limit wydatków
        window.location.href = '/';

    } else if(response === 'function-not-found') {
        // Nie znaleziono konfiguracji usługi czatu w bazie danych
        window.location.href = '/';

    } else if(response === 'missing-permissions') {
        // Użytkownik nie ma uprawnień do korzystania z usługi czatu
        window.location.href = '/';

    } else if(response === "no-aimodels-access") {
        // Błąd podczas pobierania modeli AI
        window.location.href = '/';

    } else if(response === 'success' && additionalData1) {

        // if(additionalData2) {
        //     for(let i = 0; i < additionalData2.length; i++) {
        //         $('#lastChats').append('<button id="lastChat' + i + '" class="flex-grow text-start rounded-md text-sm text-nowrap font-normal bg-transparent hover:bg-gray-100 hover:dark:bg-gray-850 p-1.5 text-gray-700 dark:text-gray-400 transition duration-200"><i class="fa-solid fa-book mr-1"></i>' + additionalData2[i].nazwaCzatu + '<span id="lastChatId' + i + '" class="hidden">' + additionalData2[i].chatId + '</span></button>');
        //     }

        //     $('#lastChatsContainer').removeClass('hidden');
        // }

        if(additionalData2) {
            $('#imienazwisko').text(additionalData2.imie + ' ' + additionalData2.nazwisko);
            $('#inicjaly').text(additionalData2.inicjaly);
        }

        window.canStartChat = true;
        // additionalData1 - selected AI model
        window.aiModel = additionalData1.nazwa_modelu;
        window.rag = additionalData2.canUseRAG;
        window.internet = additionalData2.canUseInternet;

        $('#wybierzModelAi').html(additionalData1.nazwa_wyswietlana + '<i class="fa-solid fa-chevron-down ms-2"></i>');

    } else {
        // console.log('Startup failed - unknown error');
        window.location.href = '/';
    }

});

socket.on('sessionNotFound', function() {
    window.location.href = '/auth';
});

$('#sidebarMobileToggle').on('click', function() {
    event.stopPropagation();
    // $('#sidebarMobile').css('animation', 'openSidebar 0.2s ease-in-out');
    $('#sidebar').removeClass('hidden');
    $('#sidebar').addClass('flex');
    $('#sidebar').addClass('absolute');
    $('#sidebar').addClass('top-0');
    $('#sidebar').addClass('left-0');
    $('#sidebar').addClass('z-20');
    $('#sidebar').addClass('h-svh');
    $('#sidebar').addClass('mobile-visible');

    $('#sidebar').css('animation', 'showFromLeft 0.2s ease-out');

    setTimeout(function() {
        $('#sidebar').css('animation', '');
    }, 190);
});

$(document).on('click', function(event) {
    event.stopPropagation();
    var isClickInside = sidebar.has(event.target).length > 0;

    if (!isClickInside && sidebar.hasClass('mobile-visible')) {
        $('#sidebar').css('animation', 'hideToLeft 0.2s ease-in');

        setTimeout(function() {
            $('#sidebar').css('animation', '');
            $('#sidebar').removeClass('flex');
            $('#sidebar').addClass('hidden');
            $('#sidebar').removeClass('absolute');
            $('#sidebar').removeClass('top-0');
            $('#sidebar').removeClass('left-0');
            $('#sidebar').removeClass('z-20');
            $('#sidebar').removeClass('h-svh');
            $('#sidebar').removeClass('mobile-visible');
        }, 190);

    }
});

// On unfocus
$('#chatTitle').on('blur', function() {
    if($('#chatTitle').val().length === 0 || $('#chatTitle').val() === 'Czat z AI - ' + window.wybranyPrzedmiot) {
        $('#chatTitle').val('Czat z AI - ' + window.wybranyPrzedmiot);
        socket.emit('updateChatTitle', '');
    } else {
        console.log('Zmieniono tytuł czatu');
        socket.emit('updateChatTitle', $('#chatTitle').val(), window.chatId);
    }
});

socket.on('errDisplay', function(msg, errDisplayContent) { 

    // 1. Log error to console
    console.error('Unexpected error has occurred');
    console.error('Server provided error message to be displayed to the user: ' + errDisplayContent.userMessage);
    console.error(errDisplayContent.errorCode);
    console.error('This error has been thrown by the server during following action: ' + errDisplayContent.task);

    if(errDisplayContent.moreInfo) {
        console.error('More info: ' + errDisplayContent.moreInfo);
    }


    // 2. Display error message to user
    if(errDisplayContent.userMessage && errDisplayContent.userMessage.length > 0 && errDisplayContent.showBox === true && errDisplayContent.hideAfter) {
        // Czy zrobić tak, że mogą być dwa komunikaty na raz? Pod sobą. Clone?

        errorDiv.removeClass('hidden');
        errorDiv.addClass('flex');
        errorDiv.css('animation', 'showFromBottom 0.2s ease-out');
        $('#errDisplayHtml').html(errDisplayContent.userMessage);

        setTimeout(function() {
            errorDiv.css('animation', '');
        }, 190);

        setTimeout(function() {
            errorDiv.css('animation', 'hideToBottom 0.2s ease-in-out');
            
            setTimeout(function() {
                errorDiv.addClass('hidden');
                errorDiv.removeClass('flex');
                errorDiv.css('animation', '');
            }, 150);

        }, errDisplayContent.hideAfter);

    }

    // 3. Perform action if needed
    if(errDisplayContent.takeAction && errDisplayContent.takeAction === 'refresh' && errDisplayContent.actionTimeout) {
        console.error('The server requested page reload to continue the session. This action will be performed in a few seconds to allow user to read the error.');
        setTimeout(function() {
            window.location.reload();
        }, errDisplayContent.actionTimeout);
    } else if(errDisplayContent.takeAction && errDisplayContent.takeAction === 'redirect-home' && errDisplayContent.actionTimeout) {
        console.error('The server requested user to be redirected to the home page. This action will be performed in a few seconds to allow user to read the error.');
        setTimeout(function() {
            window.location.href = '/';
        }, errDisplayContent.actionTimeout);
    } else if(errDisplayContent.takeAction && errDisplayContent.takeAction === 'redirect-logout' && errDisplayContent.actionTimeout) {
        console.log('The server requested session to destroyed. The user will have to log in again. This action will be performed in a few seconds to allow user to read the error.');
        setTimeout(function() {
            window.location.href = '/logout';
        }, errDisplayContent.actionTimeout);
    } else if(errDisplayContent.takeAction && errDisplayContent.takeAction === 'redirect-login' && errDisplayContent.actionTimeout) {
        console.log('The server requested session to destroyed. The user will have to log in again. This action will be performed in a few seconds to allow user to read the error.');
        setTimeout(function() {
            window.location.href = '/auth';
        }, errDisplayContent.actionTimeout);
    }

    // 4. Auto-report error
    if(errDisplayContent.autoReport && errDisplayContent.autoReport === true) {
        console.log('This incident will be automatically reported.');
    }

});

socket.on('disconnect', function() {

    console.warn('Lost connection to the server. Attempting to reconnect...');

    errorDisplay.removeClass('hidden');
    errorDisplay.addClass('flex');
    errorDisplay.css('animation', 'showFromBottom 0.2s ease-out');
    $('#errDisplayHtml').html('Utracono połączenie z serwerem');

    setTimeout(function() {
        errorDiv.css('animation', '');
    }, 190);

    setTimeout(function() {
        errorDisplay.css('animation', 'hideToBottom 0.2s ease-in-out');
        
        setTimeout(function() {
            errorDisplay.addClass('hidden');
            errorDisplay.removeClass('flex');
            errorDisplay.css('animation', '');
        }, 150);

    }, 8000);

});

// TYMCZASOWO
// $('#startScreen').addClass('hidden');