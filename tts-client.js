// ==UserScript==
// @name         Edge TTS Online Player (Debug)
// @namespace    http://tampermonkey.net/
// @version      0.3.9
// @description  在线实时文本转语音播放，支持正文播放、暂停和停止，紧凑样式，左下角布局
// @author       You
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js
// ==/UserScript==

(function() {
    'use strict';

    // 全局音频状态
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

    // 获取选中文字
    function getSelectedText() {
        return window.getSelection().toString().trim();
    }

    // 获取正文段落
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

    // 清理文本
    function cleanText(text) {
        let cleaned = text.replace(/adsbygoogle.*?(push|\d+)/gi, '');
        cleaned = cleaned.replace(/window\..*?=/g, '');
        cleaned = cleaned.replace(/\[.*?\]/g, '');
        cleaned = cleaned.replace(/[^\u4e00-\u9fa5A-Za-z0-9\s\n.,!?]/g, '');
        cleaned = cleaned.replace(/\s+/g, ' ');
        return cleaned.substring(0, 500).trim();
    }

    // 获取音频    ##[your-domain]这里换成你部署tts-server.py的vps地址
    async function fetchAudio(text, voice) {
        const cleanedText = cleanText(text);
        console.log('开始请求音频:', { text: cleanedText, voice });
        try {
            const response = await axios.post('[your-domain]/tts', {
                text: cleanedText,
                voice: voice
            }, {
                responseType: 'arraybuffer',
                timeout: 10000
            });
            console.log('音频请求成功:', { status: response.status, length: response.data.byteLength });
            if (response.data.byteLength === 0) {
                throw new Error('返回的音频数据为空');
            }
            return new Blob([response.data], { type: 'audio/mp3' });
        } catch (error) {
            console.error('音频请求失败:', error.message);
            throw error;
        }
    }

    // 播放音频并返回 Promise
    function playAudio(audioBlob) {
        return new Promise((resolve, reject) => {
            const audioUrl = URL.createObjectURL(audioBlob);
            currentAudio = new Audio(audioUrl);
            currentAudio.oncanplay = () => {
                console.log('音频可以播放');
                currentAudio.play().catch(e => {
                    console.error('播放失败:', e);
                    URL.revokeObjectURL(audioUrl);
                    reject(e);
                });
            };
            currentAudio.onended = () => {
                console.log('音频播放完成');
                URL.revokeObjectURL(audioUrl);
                currentAudio = null;
                resolve();
            };
            currentAudio.onerror = (e) => {
                console.error('音频播放错误:', e);
                URL.revokeObjectURL(audioUrl);
                currentAudio = null;
                reject(e);
            };
        });
    }

    // 播放选中文字
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

    // 播放正文（分段）
    async function playParagraphs(paragraphs, voice, pauseButton, stopButton) {
        console.log('开始播放正文，段落数量:', paragraphs.length);
        if (!paragraphs.length) {
            alert('未找到正文段落');
            return;
        }

        pauseButton.disabled = false;
        stopButton.disabled = true;
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

    // 主函数
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
                if (currentAudio.paused) {
                    currentAudio.play();
                    pauseButton.textContent = '暂停';
                } else {
                    currentAudio.pause();
                    pauseButton.textContent = '继续';
                }
            }
        });

        stopButton.addEventListener('click', () => {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                URL.revokeObjectURL(currentAudio.src);
                currentAudio = null;
            }
            isPlaying = false;
            pauseButton.disabled = true;
            stopButton.disabled = true;
        });
    }

    main();
})();
