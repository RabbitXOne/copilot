socket.emit('startup', 'prezentacje');

let startupTry = 0;
socket.on('startup', function(response, aiModel, ostatniePrezentacje) {
    if(response === 'auth-redirection') {
        window.location.href = '/logout';
    } else if(response === 'db-err') {
        
        // Retry
        if(startupTry < 3) {
            startupTry++;
            socket.emit('startup', 'prezentacje');
        } else {
            // Nie udało się połączyć z bazą danych
            // Odśwież stronę
            window.location.reload();
        }
    } else if(response === 'banned') {
        window.location.href = '/';

    } else if(response === 'success' && aiModel) {

        if(ostatniePrezentacje && ostatniePrezentacje.length > 0) {
            // TODO
        } else {
            $('#previousPresentations').addClass('hidden');
        }

        $('#wybierzModel').html(aiModel.nazwa_wyswietlana + ' <i class="fa-solid fa-chevron-down ms-2"></i>');
        window.wybranyModel = aiModel.nazwa_modelu;

    } else {
        // console.log('Startup failed - unknown error');
        window.location.href = '/';
    }

});

function zatwierdzWyborTematow() {
	const checkedValues = Array.from(document.querySelectorAll('#selectTematy input[type="checkbox"]:checked'))
	.map((checkbox) => {
		return checkbox.closest('label').getAttribute('value') || checkbox.closest('label').textContent.trim();
	});

    window.wybraneTematy = checkedValues;
    toggleModal();

    switch (checkedValues.length) {
        case 0:
            $('#wybierzTemat').html('Wyszukaj temat z podręcznika <i class="fa-solid fa-chevron-down ms-2"></i>');
            etap3(false);
            break;
        case 1:
            $('#wybierzTemat').html(checkedValues.length + ' temat <i class="fa-solid fa-chevron-down ms-2"></i>');
            etap3(true);
            break;
        case 2:
        case 3:
        case 4:
        case 22:
        case 23:
        case 24:
        case 32:
        case 33:
        case 34:
        case 42:
            $('#wybierzTemat').html(checkedValues.length + ' tematy <i class="fa-solid fa-chevron-down ms-2"></i>');
            etap3(true);
            break;
        case 5:
        case 6:
        case 6:
        case 7:
        case 8:
        case 9:
        case 10:
        case 11:
        case 12:
        case 13:
        case 14:
        case 15:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 21:
        case 25:
        case 26:
        case 27:
        case 28:
        case 29:
        case 30:
        case 31:
        case 35:
        case 36:
        case 37:
        case 38:
        case 39:
        case 40:
        case 41:
            $('#wybierzTemat').html(checkedValues.length + ' tematów <i class="fa-solid fa-chevron-down ms-2"></i>');
            etap3(true);
            break;
        default:
            $('#wybierzTemat').html('Wyszukaj temat z podręcznika <i class="fa-solid fa-chevron-down ms-2"></i>');
            etap3(false);
    }
}

function zaznaczCheckboxy(idsDoZaznaczenia) {
    // Znajdź wszystkie label w sekcji z checkboxami
    const labels = document.querySelectorAll('#selectTematy label');

    // Iteruj po każdym labelu
    labels.forEach(label => {
        const value = label.getAttribute('value'); // Pobierz wartość
        const checkbox = label.querySelector('input[type="checkbox"]'); // Znajdź checkbox w labelu

        // Sprawdź, czy wartość jest w liście idsDoZaznaczenia
        if (idsDoZaznaczenia.includes(value)) {
            checkbox.checked = true; // Zaznacz checkbox, jeśli wartość pasuje
        } else {
            checkbox.checked = false; // Odznacz checkbox, jeśli wartość nie pasuje
        }
    });

    if(idsDoZaznaczenia && idsDoZaznaczenia.length > 0) {
        $('#zatwierdzWyborTematow').prop('disabled', false);
    } else {
        $('#zatwierdzWyborTematow').prop('disabled', true);
    }
}

function anulujWyborTematow() {
    toggleModal();
}

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

$('#wybierzPrzedmiot').on('click', function() {
    socket.emit('przedmiotyDropdown', 'prezentacje');
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

    $('#createStep2').addClass('hidden');
    $('#createStep2Alternative').addClass('hidden');

    if(wybranyPrzedmiotId === '66d19d51c6f7e0ba2f1b1bc9') {
        $('#createStep2Alternative').removeClass('hidden');
    } else {
        $('#createStep2').removeClass('hidden');
    }

    // Resetuj dropdown z działami
    $('#wybierzTemat').html('Wyszukaj temat z podręcznika<i class="fa-solid fa-chevron-down ms-2"></i>');
    $('#selectTematy').html(`<div class="flex flex-col items-center justify-center min-h-fit max-h-24 overflow-auto p-4">
                        <svg class="loadingSpinner z-20 text-center size-12" viewBox="0 0 50 50">
                            <circle class="spinnerPath stroke-gray-400 dark:stroke-gray-300" cx="25" cy="25" r="20" fill="none" stroke-width="2"></circle>
                        </svg>
                    </div>`);
    $('#createStep3').addClass('hidden');
    $('#createStep4').addClass('hidden');
    $('#startGeneratingTest').removeClass('flex').addClass('hidden');
    etap3(false);
    $('#wiecejSzegolow').val('');
    $('#createStep2Alternative').val('');
    window.wybraneTematy = null;
    window.juzpobranotematy = null;
});

$('#wybierzTemat').on('click', function() {
    if(!window.juzpobranotematy) {
        socket.emit('tematyDialog', window.wybranyPrzedmiotId);
    } else if(window.wybraneTematy && window.wybraneTematy.length > 0) {
        zaznaczCheckboxy(window.wybraneTematy);
    }

    toggleModal();
    
});

socket.on('tematyDialog', function(tematyDzialy) {
    if(tematyDzialy === false) {
        $('#selectTematy').html('<p class="text-center text-gray-300">Nie znaleziono żadnych tematów :/</p>');
        return;
    }

    window.juzpobranotematy = true;

    $('#selectTematy').html('');
    for(let dzial of tematyDzialy) {

        $('#selectTematy').append('<h2 class="text-gray-200 font-semibold text-lg mb-3">' + dzial.numer_dzialu + '. ' + dzial.nazwa_dzialu + '</h2>')

        for(let temat of dzial.tematy) {
            $('#selectTematy').append(`<label class="checkDiv block relative pl-8 mb-3 cursor-pointer select-none text-gray-300" value="${temat._id}">${temat.numer_tematu}. ${temat.nazwa_tematu}
                    <input type="checkbox" class="absolute opacity-0 cursor-pointer w-0 h-0">
                    <span class="checkmark absolute top-0 left-0 h-6 w-6 bg-gray-750 rounded transition duration-150"></span>
                </label>`)
        }
    }
});

$('#selectTematy').on('click', 'label', () => {
    if ($('#selectTematy input[type="checkbox"]:checked').length > 0) {
        $('#zatwierdzWyborTematow').prop('disabled', false);
    } else {
        $('#zatwierdzWyborTematow').prop('disabled', true);
    }
});

$('#pptxsubject').on('input', () => {
    if($('#pptxsubject').val().length >= 3) {
        etap3(true);
    } else {
        etap3(false);
    }
})

function etap3(enable) {
    if(enable === true) {
        $('#createStep3').removeClass('hidden');
        $('#createStep4').removeClass('hidden');
    } else {
        $('#createStep3').addClass('hidden');
        $('#createStep4').addClass('hidden');
        $('#wiecejSzegolow').val('');
    }
}

let timeout = null;
$('#wiecejSzegolow').on('input', () => {
    $('#startGeneratingPptxBtn').prop('disabled', true);
    clearTimeout(timeout);
    if($('#wiecejSzegolow').val().length >= 3) {
        $('#pptxInfo').removeClass('hidden');
        $('#startGeneratingPptx').removeClass('hidden');
        $('#startGeneratingPptx').addClass('flex');
        timeout = setTimeout(obliczKoszty, 500);
    } else {
        $('#startGeneratingPptxBtn').prop('disabled', true);
        $('#pptxInfo').addClass('hidden');
        $('#startGeneratingPptx').removeClass('flex');
        $('#startGeneratingPptx').addClass('hidden');
    }
})

function obliczKoszty() {
    $('#startGeneratingPptxBtn').prop('disabled', true);
    $('#predictedPrice').html('---');

    let idPrzedmiotu = window.wybranyPrzedmiotId;
    let wybraneTematy = window.wybraneTematy;
    let tematAlternative = $('#pptxsubject').val();
    let aiModel = window.wybranyModel;
    let wiecejInfo = $('#wiecejSzegolow').val();

    socket.emit('obliczKosztyPptx', idPrzedmiotu, wybraneTematy, tematAlternative, aiModel, wiecejInfo);
}

socket.on('obliczKosztyPptx', function(cena) {
    $('#startGeneratingPptxBtn').prop('disabled', false);
    $('#predictedPrice').html(cena);
});

$('#wybierzModel').on('click', function() {
    socket.emit('aiModelDropdown', 'prezentacje');
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
    
    if($('#wiecejSzegolow').val().length >= 3) {
        $('#startGeneratingPptxBtn').prop('disabled', true);
        obliczKoszty();
    }
});

function generatePresentation() {
    $('#screen-main').addClass('hidden');
    $('#screen-loading').removeClass('hidden');

    let idPrzedmiotu = window.wybranyPrzedmiotId;
    let wybraneTematy = window.wybraneTematy;
    let tematAlternative = $('#pptxsubject').val();
    let aiModel = window.wybranyModel;
    let wiecejInfo = $('#wiecejSzegolow').val();

    socket.emit('pptxApi', idPrzedmiotu, wybraneTematy, tematAlternative, aiModel, wiecejInfo);
}

socket.on('pptxApi', (response, url) => {
    if(response === "failed") {
        $('#screen-loading').removeClass('flex').addClass('hidden');
        $('#screen-failed').removeClass('hidden').addClass('flex');

        if(url) $('#errorDetailsText').html(url);
    } else if(response === "success") {
        $('#screen-loading').removeClass('flex').addClass('hidden');
        $('#screen-success').removeClass('hidden').addClass('flex');
        $('#pptxDlLink').prop('href', 'https://storage.googleapis.com/docs-storage/usercontent/pptx/' + url + '.pptx');

        var link = document.createElement('a');
        link.href = 'https://storage.googleapis.com/docs-storage/usercontent/pptx/' + url + '.pptx';
        link.download = 'prezentacja.pptx';
        document.body.appendChild(link); 
        link.click();
        document.body.removeChild(link);
    }
});