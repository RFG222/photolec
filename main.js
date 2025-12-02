// main.js

import { GoogleGenerativeAI } from "@google/generative-ai";
// Мы больше не импортируем docx напрямую, а используем упрощенный метод сохранения DOC

// =========================================================
// !!! ВАШ КЛЮЧ !!!
const API_KEY = "ВАШ_API_КЛЮЧ_ЗДЕСЬ"; // Вставьте сюда ваш ключ в кавычках!
// =========================================================

const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = "gemini-2.5-flash"; 

// Ключ для хранения в localStorage
const STORAGE_KEY = 'aiLecturesSavedContent'; 

// Элементы DOM
const body = document.body;
const container = document.getElementById('mainContainer');
const fileInput = document.getElementById('fileInput');
const uploadLabel = document.getElementById('uploadLabel');
const resultArea = document.getElementById('result-area');
const loader = document.getElementById('loader');
const preview = document.getElementById('preview');
const errorMsg = document.getElementById('error-msg');
const shrinkBtn = document.getElementById('shrinkBtn');
const saveBtn = document.getElementById('saveBtn');
const helpModal = document.getElementById('helpModal');

let lastFullContent = ""; // Сохраняем полную версию для сжатия

// =========================================================
// === ФУНКЦИИ АВТОСОХРАНЕНИЯ ===
// =========================================================

function saveContent() {
    try {
        localStorage.setItem(STORAGE_KEY, resultArea.innerHTML);
    } catch (e) {
        console.error("Ошибка сохранения в localStorage:", e);
    }
}

function loadContent() {
    try {
        const savedContent = localStorage.getItem(STORAGE_KEY);
        if (savedContent) {
            resultArea.innerHTML = savedContent;
            lastFullContent = savedContent; 
        } else {
             // Инициализация при первом запуске
             resultArea.innerHTML = '<h3>Инструкция:</h3><p>Нажмите "Загрузить фото" и выберите файл(ы) для оцифровки.</p>';
        }
    } catch (e) {
        console.error("Ошибка загрузки из localStorage:", e);
    }
}

function clearStorage() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error("Ошибка очистки localStorage:", e);
    }
}

// =========================================================
// === ЛОКАЛЬНЫЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
// =========================================================

/** Управляет состоянием загрузки интерфейса. */
function setInterfaceLoading(isLoading) {
    if (isLoading) {
        shrinkBtn.disabled = true;
        saveBtn.disabled = true;
        uploadLabel.classList.add('disabled');
        fileInput.disabled = true;
    } else {
        shrinkBtn.disabled = false;
        saveBtn.disabled = false;
        uploadLabel.classList.remove('disabled');
        fileInput.disabled = false;
        shrinkBtn.innerText = "✨ Сжать и Скачать (Сокращенный)";
    }
}

/** * Конвертирует и сжимает файл изображения для отправки в Gemini API.
 * Уменьшение размера файла помогает снизить стоимость и ускорить обработку.
 */
async function compressAndConvertFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const MAX_WIDTH = 1200; // Целевая ширина
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Качество 0.9 для баланса между размером и четкостью текста
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9); 
                resolve({
                    inlineData: { data: dataUrl.split(',')[1], mimeType: 'image/jpeg' },
                });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/** * Преобразует HTML в doc-файл и скачивает его.
 * Используется упрощенный метод через Blob (для совместимости со старыми Word).
 */
function saveAsDocx(htmlContent, filenamePrefix) {
    // Упрощенные стили для Word
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>body { font-family: 'Times New Roman', serif; font-size: 14pt; } h1, h2, h3 { font-size: 16pt; }</style></head><body>`;
    const footer = "</body></html>";
    const fullHTML = header + htmlContent + footer;
    
    // Создаем Blob для скачивания
    const blob = new Blob(['\ufeff' + fullHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}${new Date().toLocaleDateString('ru-RU')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}


// =========================================================
// === ГЛОБАЛЬНЫЕ ФУНКЦИИ (вызываются из HTML) ===
// =========================================================

window.openModal = function() {
    helpModal.style.display = "block";
}

window.closeModal = function() {
    helpModal.style.display = "none";
}

window.onclick = function(event) {
    if (event.target == helpModal) {
        helpModal.style.display = "none";
    }
}

window.toggleLayout = function() {
    const isSplit = container.classList.toggle('split-mode');
    const btn = document.getElementById('toggleLayoutBtn');
    
    if (isSplit) {
        body.style.overflowY = 'hidden';
        btn.innerText = "⊟"; 
        btn.title = "Вертикальный вид (Мобильный)";
    } else {
        body.style.overflowY = 'auto';
        btn.innerText = "◫"; 
        btn.title = "Разделенный вид (ПК)";
    }
}

window.formatText = function(command) {
    document.execCommand(command, false, null);
    resultArea.focus();
    saveContent(); 
}

window.clearContent = function() {
    if (confirm("Очистить конспект?")) {
        resultArea.innerHTML = '';
        lastFullContent = ""; 
        clearStorage(); 
    }
}

window.shrinkAndSaveDoc = async function() {
    if (!lastFullContent.trim() || lastFullContent.length < 50) {
        alert("Конспект слишком короткий или пуст для сжатия!");
        return;
    }

    setInterfaceLoading(true);
    shrinkBtn.innerText = "⏳ Сжимаю...";
    loader.innerText = "⚡ Сжатие текста...";
    loader.style.display = 'block';
    
    let compressedHTML = "";

    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const shrinkPrompt = `Сократи этот текст, оставив суть, ключевые идеи и определения. Сделай его более структурированным. Сохрани HTML (<h1>, <ul>, <li>). Верни ТОЛЬКО HTML: ${lastFullContent}`;

        const result = await model.generateContent(shrinkPrompt);
        compressedHTML = result.response.text;
        compressedHTML = compressedHTML.replace(/```html/g, "").replace(/```/g, "").trim();

    } catch (error) {
        console.error("API Error (Shrink):", error);
        alert("Ошибка сжатия. Попробуйте еще раз.");
        compressedHTML = lastFullContent; 
    } finally {
        loader.style.display = 'none';
        setInterfaceLoading(false);
    }
    
    saveAsDocx(compressedHTML, 'Сокращенный_Конспект_');
}

window.saveDoc = function() {
    const contentToSave = resultArea.innerHTML.trim() ? resultArea.innerHTML : lastFullContent;
    if (!contentToSave.trim()) {
        alert("Нечего сохранять! Область конспекта пуста.");
        return;
    }
    saveAsDocx(contentToSave, 'Полный_Конспект_');
}


// --- ГЛАВНЫЙ ОБРАБОТЧИК ЗАГРУЗКИ ФАЙЛА И ГЕНЕРАЦИИ (ПАКЕТНЫЙ РЕЖИМ) ---
fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files.length === 0) return;

    setInterfaceLoading(true);

    preview.style.display = 'none'; 
    errorMsg.style.display = 'none';

    // Включаем разделенный вид (если это ПК)
    if (window.innerWidth > 800 && !container.classList.contains('split-mode')) {
       toggleLayout(); 
    }

    resultArea.style.opacity = "0.7";
    let allGeneratedText = "";
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        loader.innerText = `⚡ Анализирую файл ${i + 1} из ${files.length}: ${file.name}...`;
        loader.style.display = 'block';

        if (i === 0) {
            preview.src = URL.createObjectURL(file);
            preview.style.display = 'block';
        }

        let text = "";
        let imagePart; 

        try {
            imagePart = await compressAndConvertFile(file);
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });

            const prompt = `Ты - помощник студента. Проанализируй изображение (слайд/конспект). 
            1. Распознай весь текст.
            2. Исправь ошибки.
            3. Оформи результат СТРОГО В HTML: <h1>, <h2>, <b>, <ul>, <li>.
            4. ВАЖНО: Верни ТОЛЬКО HTML код конспекта, без лишних слов и markdown.`;

            const result = await model.generateContent([prompt, imagePart]);
            text = result.response.text; 
            
        } catch (error) {
            console.error(`API Error (Файл ${i + 1}):`, error);
            let msg = error.message;
            if (msg.includes("400")) msg = "❌ Ошибка региона (VPN) или API-ключа.";
            errorMsg.innerText = `[Ошибка при обработке файла ${i + 1}]: ${msg}`;
            errorMsg.style.display = 'block';
            text = `<b><p>[Ошибка: ${msg}]</p></b>`; 
        } 
        
        // Добавляем разделитель между конспектами (кроме первого)
        const separator = i > 0 ? "<hr>" : "";
        
        text = text.replace(/```html/g, "").replace(/```/g, "").trim();
        
        allGeneratedText += separator + text;
    }
    
    // Окончательное обновление
    const currentContent = resultArea.innerHTML.trim();
    const isInitialPlaceholder = currentContent.includes('Инструкция:') || currentContent.length < 10;
    const finalSeparator = !isInitialPlaceholder ? "<p>&nbsp;</p>" : ""; 
    
    // Если это первый запуск, заменяем инструкцию, иначе добавляем контент
    resultArea.innerHTML = isInitialPlaceholder ? allGeneratedText : currentContent + finalSeparator + allGeneratedText;
    
    resultArea.style.opacity = "1";
    lastFullContent = resultArea.innerHTML;
    saveContent(); 
    
    loader.style.display = 'none';
    setInterfaceLoading(false);
});

// ИНИЦИАЛИЗАЦИЯ:
resultArea.addEventListener('input', saveContent);
document.addEventListener('DOMContentLoaded', loadContent);
