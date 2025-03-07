// ==UserScript==
// @name         Edge TTS Online Player (Debug)
// @namespace    http://tampermonkey.net/
// @version      0.3.11
// @description  在线实时文本转语音播放，支持正文播放、暂停和停止，紧凑样式，左下角布局
// @author       You
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    let currentAudio = null;
    let isPlaying = false;
    let paragraphs = [];
    let currentIndex = 0;

    // 创建界面
    function createUI() {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            z-index: 9999;
            background: white;
            padding: 5px;
            border-radius: 3px;
            box-shadow: 0 0 5px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 5px;
        `;

        const voiceSelect = document.createElement('select');
        voiceSelect.style.cssText = `font-size: 12px; padding: 2px;`;
        voiceSelect.innerHTML = `
            <option value="zh-CN-XiaoxiaoNeural">中文(女-晓晓)</option>
            <option value="zh-CN-YunxiNeural">中文(男-云希)</option>
            <option value="en-US-AriaNeural">英文(女-Aria)</option>
        `;

        const playSelectedButton = document.createElement('button');
        playSelectedButton.textContent = '选择';
        playSelectedButton.style.cssText = `font-size: 12px; padding: 2px 6px; border: 1px solid #ccc; border-radius: 3px; cursor: pointer;`;

        const playAllButton = document.createElement('button');
        playAllButton.textContent = '全文';
        playAllButton.style.cssText = `font-size: 12px; padding: 2px 6px; border: 1px solid #ccc; border-radius: 3px; cursor: pointer;`;

        const pauseButton = document.createElement('button');
        pauseButton.textContent = '暂停';
        pauseButton.style.cssText = `font-size: 12px; padding: 2px 6px; border: 1px solid #ccc; border-radius: 3px; cursor: pointer;`;
        pauseButton.disabled = true;

        const stopButton = document.createElement('button');
        stopButton.textContent = '停止';
        stopButton.style.cssText = `font-size: 12px; padding: 2px 6px; border: 1px solid #ccc; border-radius: 3px; cursor: pointer;`;
        stopButton.disabled = true;

        container.appendChild(voiceSelect);
        container.appendChild(playSelectedButton);
        container.appendChild(playAllButton);
        container.appendChild(pauseButton);
        container.appendChild(stopButton);
        document.body.appendChild(container);

        return { playSelectedButton, playAllButton, pauseButton, stopButton, voiceSelect };
    }

    function getSelectedText() {
        return window.getSelection().toString().trim();
    }

    function getParagraphs() {
        const paragraphs = [];
        const contentAreas = document.querySelectorAll('article p, .post-content p, .entry-content p, .article-body p, main p');
        contentAreas.forEach(el => {
            if (!el.closest('nav, header, footer, aside, .menu, .ads, script, style')) {
                const text = el.textContent.trim();
                if (text) {
                    paragraphs.push(text);
                }
            }
        });
        console.log('提取的正文段落数量:', paragraphs.length);
        console.log('正文段落内容:', paragraphs.map(p => p.substring(0, 50) + '...'));
        return paragraphs.filter(text => text.length > 0);
    }

    function cleanText(text) {
        let cleaned = text.replace(/adsbygoogle.*?(push|\d+)/gi, '');
        cleaned = cleaned.replace(/window\..*?=/g, '');
        cleaned = cleaned.replace(/\[.*?\]/g, '');
        cleaned = cleaned.replace(/[^\u4e00-\u9fa5A-Za-z0-9\s\n.,!?]/g, '');
        cleaned = cleaned.replace(/\s+/g, ' ');
        return cleaned.substring(0, 500).trim();
    }

    function fetchAudio(text, voice) {
        const cleanedText = cleanText(text);
        console.log('开始请求音频:', { text: cleanedText, voice });
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://xx.xx.xx/tts', // 请替换为实际域名
                headers: {'Content-Type': 'application/json'},
                data: JSON.stringify({text: cleanedText, voice: voice}),
                responseType: 'arraybuffer',
                timeout: 10000,
                onload: (response) => {
                    if (response.response.byteLength === 0) {
                        reject(new Error('返回的音频数据为空'));
                    } else {
                        resolve(new Blob([response.response], { type: 'audio/mp3' }));
                    }
                },
                onerror: (error) => reject(new Error('Network Error')),
                ontimeout: () => reject(new Error('Request Timeout'))
            });
        });
    }

    function playAudio(audioBlob) {
        return new Promise((resolve, reject) => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const reader = new FileReader();
            
            reader.onload = function(e) {
                audioContext.decodeAudioData(e.target.result, (buffer) => {
                    const source = audioContext.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioContext.destination);
                    source.onended = () => {
                        audioContext.close();
                        currentAudio = null;
                        resolve();
                    };
                    source.start(0);
                    currentAudio = source;
                    currentAudio.context = audioContext;
                }, (error) => {
                    console.error('音频解码错误:', error);
                    reject(error);
                });
            };
            
            reader.onerror = (e) => {
                console.error('读取 Blob 错误:', e);
                reject(e);
            };
            
            reader.readAsArrayBuffer(audioBlob);
        });
    }

    async function playSelected(text, voice, pauseButton, stopButton) {
        if (!text) {
            alert('请先选择文字');
            return;
        }
        try {
            pauseButton.disabled = false;
            stopButton.disabled = false;
            isPlaying = true;
            const audioBlob = await fetchAudio(text, voice);
            await playAudio(audioBlob);
        } catch (error) {
            alert('播放失败，请检查服务或网络');
        } finally {
            isPlaying = false;
            pauseButton.disabled = true;
            stopButton.disabled = true;
        }
    }

    async function playParagraphs(paragraphs, voice, pauseButton, stopButton) {
        console.log('开始播放正文，段落数量:', paragraphs.length);
        if (!paragraphs.length) {
            alert('未 Mubarak 未找到正文段落');
            return;
        }

        pauseButton.disabled = false;
        stopButton.disabled = false;
        isPlaying = true;
        currentIndex = 0;

        for (; currentIndex < paragraphs.length && isPlaying; currentIndex++) {
            console.log(`处理段落 ${currentIndex + 1}/${paragraphs.length}:`, paragraphs[currentIndex].substring(0, 50) + '...');
            try {
                const audioBlob = await fetchAudio(paragraphs[currentIndex], voice);
                await playAudio(audioBlob);
            } catch (error) {
                console.error(`段落 ${currentIndex + 1} 处理或播放失败:`, error);
                alert(`段落 ${currentIndex + 1} 播放失败，继续下一段`);
            }
        }
        console.log('正文播放完成');
        isPlaying = false;
        pauseButton.disabled = true;
        stopButton.disabled = true;
        currentAudio = null;
    }

    function main() {
        const { playSelectedButton, playAllButton, pauseButton, stopButton, voiceSelect } = createUI();

        playSelectedButton.addEventListener('click', () => {
            const text = getSelectedText();
            const voice = voiceSelect.value;
            playSelected(text, voice, pauseButton, stopButton);
        });

        playAllButton.addEventListener('click', () => {
            paragraphs = getParagraphs();
            const voice = voiceSelect.value;
            playParagraphs(paragraphs, voice, pauseButton, stopButton);
        });

        pauseButton.addEventListener('click', () => {
            if (currentAudio) {
                if (currentAudio.context.state === 'running') {
                    currentAudio.context.suspend();
                    pauseButton.textContent = '继续';
                } else {
                    currentAudio.context.resume();
                    pauseButton.textContent = '暂停';
                }
            }
        });

        stopButton.addEventListener('click', () => {
            if (currentAudio) {
                currentAudio.stop();
                currentAudio.context.close();
                currentAudio = null;
                isPlaying = false;
                pauseButton.disabled = true;
                stopButton.disabled = true;
            }
        });
    }

    main();
})();
