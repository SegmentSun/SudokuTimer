// 数独比赛计时器

// 默认配置
const DEFAULT_CONFIG = {
    eventName: '2026全国数独锦标赛',
    rounds: [
        { type: 'round', roundName: '第1轮', duration: 30, alerts: [
            { minutes: 5, enabled: true },
            { minutes: 1, enabled: true }
        ], rotationEnabled: false, rotationInterval: 30 }
    ],
    voicePack: 'zh-1',
    bgColor: '#2c3e50',
    textColor: '#ffffff',
    fontFamily: "system-ui, -apple-system, sans-serif",
    eventNameSize: 45,
    roundNameSize: 35,
    timerSize: 250
};

// 语音包配置
// 结构：语言 -> 语音包ID -> { 文件名映射, 可用时间点 }
const VOICE_PACKS = {
    zh: {
        '1': {
            name: '中文语音包1',
            files: {
                5: 'audios/zh/1/5min.mp3',
                1: 'audios/zh/1/1min.mp3',
                'end': 'audios/zh/1/end.mp3',
                'rotation': 'audios/zh/1/rotation.mp3'
            }
        }
    },
    en: {
        '1': {
            name: 'English Pack 1',
            files: {
                5: 'audios/en/1/5min.mp3',
                1: 'audios/en/1/1min.mp3',
                'end': 'audios/en/1/end.mp3',
                'rotation': 'audios/en/1/rotation.mp3'
            }
        }
    }
};

// 获取可用的语音包列表
function getAvailableVoicePacks() {
    const packs = [];
    for (const [lang, langPacks] of Object.entries(VOICE_PACKS)) {
        for (const [packId, packInfo] of Object.entries(langPacks)) {
            packs.push({
                id: `${lang}-${packId}`,
                lang: lang,
                packId: packId,
                name: packInfo.name
            });
        }
    }
    return packs;
}

// 获取语音包的语言
function getVoicePackLang(voicePackId) {
    return voicePackId.split('-')[0];
}

// 获取语音包的ID
function getVoicePackNumber(voicePackId) {
    return voicePackId.split('-')[1];
}

// 全局状态
let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let audioContext = null;
let audioElements = {};
let audioSources = {};
let currentRoundIndex = 0;
let timerInterval = null;
let remainingSeconds = 0;
let isPaused = false;
let isPreview = false;
let alertedTimes = new Set();
let lastRotationAlert = 0;
let totalDuration = 0;
let isAudioPreloaded = false;
let cachedVoices = [];
let startTime = Date.now();
let pausedElapsed = 0;
let pausedAt = 0;

// DOM 元素引用
const elements = {};

// 初始化
// 渲染语音包选项
function renderVoicePackOptions() {
    const container = document.getElementById('voice-pack-options');
    if (!container) return;
    
    container.innerHTML = '';
    
    // 遍历所有语音包并生成选项
    for (const [lang, langPacks] of Object.entries(VOICE_PACKS)) {
        for (const [packId, packInfo] of Object.entries(langPacks)) {
            const packIdFull = `${lang}-${packId}`;
            const isChecked = config.voicePack === packIdFull || (!config.voicePack && lang === 'zh' && packId === '1');
            const langName = lang === 'zh' ? '中文' : 'English';
            
            const label = document.createElement('label');
            label.className = 'voice-pack-option';
            label.innerHTML = `
                <input type="radio" name="voice-pack" value="${packIdFull}" ${isChecked ? 'checked' : ''}>
                <div class="voice-pack-card">
                    <span class="voice-pack-name">${langName}语音包${packId}</span>
                    <span class="voice-pack-files">${packInfo.name}</span>
                </div>
            `;
            container.appendChild(label);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initElements();
    loadConfig();
    renderVoicePackOptions(); // 动态渲染语音包选项
    bindEvents();
    renderRounds();
    updateUI();
    updateAudioStatus('pending', '请先加载语音包');
    bindRoundInputEvents();
    
    // 预加载语音列表
    console.log('开始预加载语音列表...');
    getVoicesWithTimeout().then(voices => {
        console.log('预加载完成，语音列表:', voices.map(v => `${v.name} (${v.lang})`));
    });
});

// 初始化 DOM 元素引用
function initElements() {
    elements.editPanel = document.getElementById('edit-panel');
    elements.roundsContainer = document.getElementById('rounds-container');
    elements.addRoundBtn = document.getElementById('add-round');
    elements.addBreakBtn = document.getElementById('add-break');
    elements.bgColor = document.getElementById('bg-color');
    elements.textColor = document.getElementById('text-color');
    elements.fontFamily = document.getElementById('font-family');
    elements.eventNameSize = document.getElementById('event-name-size');
    elements.eventNameSizeValue = document.getElementById('event-name-size-value');
    elements.roundNameSize = document.getElementById('round-name-size');
    elements.roundNameSizeValue = document.getElementById('round-name-size-value');
    elements.timerSize = document.getElementById('timer-size');
    elements.timerSizeValue = document.getElementById('timer-size-value');
    elements.audioLoadStatus = document.getElementById('audio-load-status');
    elements.loadVoicePackBtn = document.getElementById('load-voice-pack');
    elements.saveSettings = document.getElementById('save-settings');
    elements.startTimer = document.getElementById('start-timer');
    elements.previewTimer = document.getElementById('preview-timer');
    elements.resetDefaults = document.getElementById('reset-defaults');
    elements.timerDisplay = document.getElementById('timer-display');
    elements.displayEventName = document.getElementById('display-event-name');
    elements.displayRoundName = document.getElementById('display-round-name');
    elements.timer = document.getElementById('timer');
    elements.nextRoundInfo = document.getElementById('next-round-info');
    elements.nextRoundName = document.getElementById('next-round-name');
    elements.progressFill = document.getElementById('progress-fill');
    elements.pauseBtn = document.getElementById('pause-btn');
    elements.resumeBtn = document.getElementById('resume-btn');
    elements.skipBtn = document.getElementById('skip-btn');
    elements.stopBtn = document.getElementById('stop-btn');
    elements.fullscreenBtn = document.getElementById('fullscreen-btn');
    elements.exitBtn = document.getElementById('exit-btn');
    elements.globalEventName = document.getElementById('global-event-name');
}

// 绑定事件
function bindEvents() {
    elements.addRoundBtn.addEventListener('click', () => addRound('round'));
    elements.addBreakBtn.addEventListener('click', () => addRound('break'));
    elements.loadVoicePackBtn.addEventListener('click', loadVoicePack);
    elements.eventNameSize.addEventListener('input', (e) => {
        elements.eventNameSizeValue.textContent = e.target.value + 'px';
    });
    elements.roundNameSize.addEventListener('input', (e) => {
        elements.roundNameSizeValue.textContent = e.target.value + 'px';
    });
    elements.timerSize.addEventListener('input', (e) => {
        elements.timerSizeValue.textContent = e.target.value + 'px';
    });
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.startTimer.addEventListener('click', startTimer);
    elements.previewTimer.addEventListener('click', previewTimer);
    elements.resetDefaults.addEventListener('click', resetDefaults);
    elements.pauseBtn.addEventListener('click', pauseTimer);
    elements.resumeBtn.addEventListener('click', resumeTimer);
    elements.skipBtn.addEventListener('click', skipRound);
    elements.stopBtn.addEventListener('click', stopTimer);
    elements.fullscreenBtn.addEventListener('click', toggleFullscreen);
    elements.exitBtn.addEventListener('click', exitTimer);
    elements.globalEventName.addEventListener('input', (e) => {
        config.eventName = e.target.value;
    });
    document.addEventListener('keydown', handleKeyboard);
}

// 更新音频状态显示
function updateAudioStatus(status, message) {
    const indicator = elements.audioLoadStatus.querySelector('.status-indicator');
    indicator.className = `status-indicator ${status}`;
    indicator.textContent = message;
}

// 加载语音包 - 使用 HTML5 Audio，支持多语音包和fallback
async function loadVoicePack() {
    try {
        const voicePackId = document.querySelector('input[name="voice-pack"]:checked')?.value || 'zh-1';
        config.voicePack = voicePackId;
        
        const lang = getVoicePackLang(voicePackId);
        const packId = getVoicePackNumber(voicePackId);
        
        console.log('开始加载语音包:', voicePackId, '语言:', lang, '包ID:', packId);

        updateAudioStatus('loading', '正在加载音频...');

        // 获取语音包配置
        const packConfig = VOICE_PACKS[lang]?.[packId];
        if (!packConfig) {
            throw new Error('未找到语音包配置');
        }
        
        const files = packConfig.files;
        console.log('音频文件列表:', files);
        
        // 清空之前的音频元素
        audioElements = {};
        
        // 逐个加载音频
        for (const [key, path] of Object.entries(files)) {
            console.log(`加载中: ${key} - ${path}`);
            
            try {
                const audio = new Audio();
                
                // 使用 Promise 包装 load 事件
                await new Promise((resolve, reject) => {
                    audio.addEventListener('canplaythrough', resolve);
                    audio.addEventListener('error', () => {
                        // 文件不存在时也resolve，避免中断加载流程
                        console.warn(`音频文件不存在: ${path}`);
                        resolve();
                    });
                    audio.src = path;
                    audio.load();
                });
                
                // 检查音频是否成功加载（duration > 0 表示加载成功）
                if (audio.duration > 0) {
                    audioElements[key] = audio;
                    console.log(`已加载: ${key}, 时长: ${audio.duration}秒`);
                } else {
                    console.warn(`音频文件不存在或无法加载: ${path}`);
                }
                
                // 每个音频加载后稍作延迟
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (err) {
                console.error(`加载失败: ${key}`, err);
            }
        }
        
        isAudioPreloaded = true;
        
        // 统计成功加载的音频
        const loadedCount = Object.keys(audioElements).length;
        const totalCount = Object.keys(files).length;
        
        if (loadedCount === totalCount) {
            updateAudioStatus('ready', '音频已就绪');
            showToast('语音包加载完成');
        } else {
            updateAudioStatus('ready', `已加载${loadedCount}/${totalCount}个音频，部分将使用语音合成`);
            showToast(`语音包部分加载成功 (${loadedCount}/${totalCount})，缺失音频将使用语音合成`);
        }
        
        // 预热 AudioContext - 播放一个静音来激活
        warmupAudio();
    } catch (error) {
        console.error('加载语音包失败:', error);
        updateAudioStatus('error', '音频加载失败: ' + error.message);
        showToast('音频加载失败: ' + error.message, 'error');
    }
}

// 播放音频 - 使用 HTML5 Audio 作为 source，通过 Web Audio API 播放
// 预热 AudioContext - 第一次播放前调用来激活音频系统
function warmupAudio() {
    console.log('预热 AudioContext...');
    
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    }
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // 预先创建所有音频的 source 连接
    for (const [key, audio] of Object.entries(audioElements)) {
        if (audio && !audioSources[key]) {
            try {
                const source = audioContext.createMediaElementSource(audio);
                source.connect(audioContext.destination);
                audioSources[key] = source;
                console.log(`已预创建 source: ${key}`);
            } catch (e) {
                console.warn(`创建 source 失败: ${key}`, e);
            }
        }
    }
    
    // 创建一个短的静音来预热
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    gainNode.gain.value = 0; // 静音
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
    
    // 额外播放一个极短的静音音频来完全预热音频管道
    setTimeout(() => {
        try {
            const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.01, audioContext.sampleRate);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
            console.log('静音预热播放完成');
        } catch (e) {
            console.warn('静音预热失败:', e);
        }
    }, 100);
    
    console.log('AudioContext 预热完成');
}

// 播放预热音
function playWarmupTone(callback) {
    console.log('播放预热音...');

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    gainNode.gain.value = 0.001; // 设置预热音音量为静音
    oscillator.type = 'sine';
    oscillator.frequency.value = 440; // 预热音频率

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 1); // 持续 1 秒

    oscillator.onended = () => {
        console.log('预热音播放完成');
        if (callback) callback(); // 预热音播放完成后执行回调
    };
}

// 数字转英文函数
const NUMBER_TO_ENGLISH = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
    'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty'
];

function numberToEnglish(num) {
    if (num >= 0 && num <= 30) {
        return NUMBER_TO_ENGLISH[num];
    }
    return num.toString();
}

// 判断一个声音是否为男声（基于名称关键词）
// 注意：Windows 中文语音(Kangkang, Huihui, Yaoyao)都是女声
function isMaleVoice(voice) {
  const maleKeywords = [
    // 英文男声常见关键词
    'male', 'Male', 'David', 'Mark', 'George', 'Paul', 'Daniel',
    'James', 'John', 'Robert', 'Michael', 'William', 'Richard',
    // 中文男声 - Windows 默认语音都是女声，所以这个列表通常为空
    // 只有当系统安装了额外的语音包时才会生效
    '云希', 'Yunxi', '云扬', 'Yunyang', '男', '男性', '男生',
  ];
  return maleKeywords.some(keyword => voice.name.includes(keyword));
}

// 获取可用的声音列表（带等待加载和缓存）
function getVoicesWithTimeout() {
    return new Promise((resolve) => {
        // 如果已有缓存，直接返回
        if (cachedVoices.length > 0) {
            resolve(cachedVoices);
            return;
        }
        
        const maxAttempts = 10;
        const delay = 100;
        let attempts = 0;
        
        function tryGetVoices() {
            let voices = window.speechSynthesis.getVoices();
            
            if (voices.length > 0) {
                console.log(`获取到 ${voices.length} 个语音 (尝试 ${attempts + 1}次)`);
                cachedVoices = voices; // 缓存结果
                resolve(voices);
                return;
            }
            
            attempts++;
            if (attempts < maxAttempts) {
                console.log(`等待语音加载... (尝试 ${attempts}/${maxAttempts})`);
                setTimeout(tryGetVoices, delay);
            } else {
                console.log('未能获取到语音列表');
                resolve([]);
            }
        }
        
        // 首先尝试直接获取
        tryGetVoices();
    });
}

// 语音合成函数 - 使用 Web Speech API
async function speakText(text, useEnglish = null) {
    console.log('语音合成:', text);
    
    if (!('speechSynthesis' in window)) {
        console.warn('浏览器不支持语音合成');
        return;
    }

    // 自动检测语言：如果文本包含英文字母，或者指定了英文
    if (useEnglish === true || (useEnglish === null && /[a-zA-Z]/.test(text))) {
        // 翻译阿拉伯数字为英文
        text = text.replace(/\d+/g, (match) => {
            const num = parseInt(match);
            return numberToEnglish(num);
        });
    }
    
    const isEnglish = useEnglish === true || (useEnglish === null && /[a-zA-Z]/.test(text));
    const lang = isEnglish ? 'en-US' : 'zh-CN';

    playWarmupTone(async () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 1.0;
        
        // 异步获取 voices
        const voices = await getVoicesWithTimeout();
        console.log('可用语音列表:', voices.map(v => `${v.name} (${v.lang})`));
        
        if (voices.length > 0) {
            // 优先选择男声
            const matchingVoices = voices.filter(v => 
                v.lang.startsWith(isEnglish ? 'en' : 'zh')
            );
            console.log('匹配语言的语音:', matchingVoices.map(v => v.name));
            
            const maleVoice = matchingVoices.find(v => isMaleVoice(v));
            
            if (maleVoice) {
                utterance.voice = maleVoice;
                utterance.pitch = 1.0;
                console.log('✓ 使用男声:', maleVoice.name);
            } else {
                // 没有男声时使用第一个匹配的语音，并降低音调模拟男声
                if (matchingVoices.length > 0) {
                    utterance.voice = matchingVoices[0];
                    utterance.pitch = 0.8; // 降低音调模拟男声
                    console.log('使用女声模拟男声:', matchingVoices[0].name, '(pitch=0.8)');
                }
            }
        }
        
        window.speechSynthesis.speak(utterance);
    });
}

// 修改 playAudio 函数，添加更多日志以便调试
function playAudio(type) {
    console.log(`播放音频: ${type}, Element存在: ${!!audioElements[type]}`);

    if (!audioElements[type]) {
        console.warn(`音频未加载: ${type}`);
        return;
    }

    try {
        // 确保 AudioContext 存在并处于运行状态
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        // 播放预热音，然后播放目标音频
        playWarmupTone(() => {
            console.log('预热音播放完成，准备播放目标音频');

            if (!audioSources[type]) {
                const source = audioContext.createMediaElementSource(audioElements[type]);
                source.connect(audioContext.destination);
                audioSources[type] = source;
                console.log(`已创建 source: ${type}`);
            }

            // 重置到开头并播放
            audioElements[type].currentTime = 0;
            audioElements[type].volume = 1.0;

            const playPromise = audioElements[type].play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log(`音频 ${type} 播放成功`);
                }).catch((error) => {
                    console.error(`音频 ${type} 播放失败:`, error);
                });
            }
        });
    } catch (error) {
        console.error('播放失败:', error);
    }
}

// 添加轮次
function addRound(type) {
    const round = {
        type: type,
        roundName: type === 'round' ? `第${config.rounds.filter(r => r.type === 'round').length + 1}轮` : '场间休息',
        duration: type === 'round' ? 30 : 10,
        alerts: type === 'round' ? [
            { minutes: 5, enabled: true },
            { minutes: 1, enabled: true }
        ] : [],
        rotationEnabled: false,
        rotationInterval: 30
    };
    config.rounds.push(round);
    renderRounds();
    bindRoundInputEvents(); // 确保新轮次的输入框绑定事件
}

// 删除轮次
function removeRound(index) {
    config.rounds.splice(index, 1);
    renderRounds();
}

// 渲染轮次列表
function renderRounds() {
    elements.roundsContainer.innerHTML = '';

    config.rounds.forEach((round, index) => {
        console.log('round:', round);
        console.log(index);
        const roundEl = document.createElement('div');
        roundEl.className = `round-item ${round.type}`;
        
        const typeLabel = round.type === 'round' ? '比赛轮次' : '场间休息';
        const alerts = round.alerts || [];
        
        let alertsHtml = '';
        alerts.forEach((alert, alertIndex) => {
            alertsHtml += `
                <div class="alert-item" data-alert-index="${alertIndex}">
                    <input type="checkbox" class="alert-enabled" ${alert.enabled !== false ? 'checked' : ''}>
                    <span>剩余</span>
                    <input type="number" class="alert-minutes" value="${alert.minutes}" min="1" max="180" style="width: 60px;"> 
                    <span>分钟</span>
                    <button class="remove-alert btn-remove-small">×</button>
                </div>
            `;
        });

        const durationMinutes = round.duration ? Math.floor(round.duration / 60) : 0;
        const durationSeconds = round.duration ? round.duration % 60 : 0;

        roundEl.innerHTML = `
            <div class="round-header">
                <span class="round-number">#${index + 1}</span>
                <span class="round-type-badge ${round.type}">${typeLabel}</span>
            </div>
            <button class="remove-round" data-index="${index}">×</button>
            <div class="round-fields">
                ${round.type === 'round' ? `
                    <div class="form-group">
                        <label>轮次名称</label>
                        <input type="text" class="round-round-name" value="${round.roundName}" placeholder="轮次名称">
                    </div>
                ` : `
                    <div class="form-group full-width">
                        <label>休息名称</label>
                        <input type="text" class="round-round-name" value="${round.roundName}" placeholder="休息名称">
                    </div>
                `}
                <div class="form-group duration-group">
                    <label>时长</label>
                    <div class="duration-inputs">
                        <input type="number" class="round-duration-min" value="${durationMinutes}" min="0" max="180">
                        <span>分</span>
                        <input type="number" class="round-duration-sec" value="${durationSeconds}" min="0" max="59">
                        <span>秒</span>
                    </div>
                </div>
                ${round.type === 'round' ? `
                    <div class="form-group full-width">
                        <label>提醒设置</label>
                        <div class="alerts-container">
                            ${alertsHtml}
                        </div>
                        <button class="btn btn-secondary btn-small add-alert-btn">+ 添加提醒</button>
                    </div>
                    <div class="form-group full-width">
                        <label>
                            <input type="checkbox" class="rotation-enabled" ${round.rotationEnabled ? 'checked' : ''}>
                            启用轮转模式
                        </label>
                        <div class="rotation-settings" style="${round.rotationEnabled ? '' : 'display:none'}">
                            <input type="number" class="round-rotation-interval" value="${round.rotationInterval}" min="1" max="300">
                            <span>秒/次</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        elements.roundsContainer.appendChild(roundEl);

        // 绑定轮转模式开关事件
        const rotationEnabledCheckbox = roundEl.querySelector('.rotation-enabled');
        if (rotationEnabledCheckbox) {
            rotationEnabledCheckbox.addEventListener('change', (e) => {
                const settingsDiv = roundEl.querySelector('.rotation-settings');
                if (settingsDiv) {
                    settingsDiv.style.display = e.target.checked ? 'flex' : 'none';
                }
                config.rounds[index].rotationEnabled = e.target.checked;
            });
        }

        roundEl.querySelector('.remove-round').addEventListener('click', () => removeRound(index));

        const addAlertBtn = roundEl.querySelector('.add-alert-btn');
        if (addAlertBtn) {
            addAlertBtn.addEventListener('click', () => {
                if (!config.rounds[index].alerts) {
                    config.rounds[index].alerts = [];
                }
                config.rounds[index].alerts.push({ minutes: 3, enabled: true });
                renderRounds();
                bindRoundInputEvents();
            });
        }

        roundEl.querySelectorAll('.remove-alert').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const alertIndex = parseInt(e.target.closest('.alert-item').dataset.alertIndex);
                config.rounds[index].alerts.splice(alertIndex, 1);
                renderRounds();
                bindRoundInputEvents();
            });
        });
    });
}

// 为轮次输入框绑定事件，确保输入内容即时保存到 config
function bindRoundInputEvents() {
    const roundItems = document.querySelectorAll('.round-item');
    roundItems.forEach((roundEl, index) => {
        const roundNameInput = roundEl.querySelector('.round-round-name');
        const durationMinInput = roundEl.querySelector('.round-duration-min');
        const durationSecInput = roundEl.querySelector('.round-duration-sec');
        const rotationEnabledCheckbox = roundEl.querySelector('.rotation-enabled');
        const rotationIntervalInput = roundEl.querySelector('.round-rotation-interval');

        if (roundNameInput) {
            roundNameInput.addEventListener('input', (e) => {
                config.rounds[index].roundName = e.target.value;
            });
        }

        if (durationMinInput && durationSecInput) {
            const updateDuration = () => {
                const mins = parseInt(durationMinInput.value) || 0;
                const secs = parseInt(durationSecInput.value) || 0;
                config.rounds[index].duration = mins * 60 + secs;
            };
            durationMinInput.addEventListener('input', updateDuration);
            durationSecInput.addEventListener('input', updateDuration);
        }

        if (rotationEnabledCheckbox) {
            rotationEnabledCheckbox.addEventListener('change', (e) => {
                config.rounds[index].rotationEnabled = e.target.checked;
                const settingsDiv = roundEl.querySelector('.rotation-settings');
                if (settingsDiv) {
                    settingsDiv.style.display = e.target.checked ? 'flex' : 'none';
                }
            });
        }

        if (rotationIntervalInput) {
            rotationIntervalInput.addEventListener('input', (e) => {
                config.rounds[index].rotationInterval = parseInt(e.target.value) || 30;
            });
        }

        roundEl.querySelectorAll('.alert-item').forEach((alertEl, alertIndex) => {
            const enabledCheckbox = alertEl.querySelector('.alert-enabled');
            const minutesInput = alertEl.querySelector('.alert-minutes');

            if (enabledCheckbox) {
                enabledCheckbox.addEventListener('change', (e) => {
                    if (!config.rounds[index].alerts) config.rounds[index].alerts = [];
                    if (!config.rounds[index].alerts[alertIndex]) {
                        config.rounds[index].alerts[alertIndex] = { minutes: 5, enabled: true };
                    }
                    config.rounds[index].alerts[alertIndex].enabled = e.target.checked;
                });
            }

            if (minutesInput) {
                minutesInput.addEventListener('input', (e) => {
                    if (!config.rounds[index].alerts) config.rounds[index].alerts = [];
                    if (!config.rounds[index].alerts[alertIndex]) {
                        config.rounds[index].alerts[alertIndex] = { minutes: 5, enabled: true };
                    }
                    config.rounds[index].alerts[alertIndex].minutes = parseInt(e.target.value) || 1;
                });
            }
        });
    });
}

// 从表单读取配置
function readConfigFromForm() {
    const rounds = [];
    document.querySelectorAll('.round-item').forEach((el) => {
        const type = el.classList.contains('break') ? 'break' : 'round';
        const alerts = [];
        if (type === 'round') {
            el.querySelectorAll('.alert-item').forEach(alertEl => {
                alerts.push({
                    minutes: parseInt(alertEl.querySelector('.alert-minutes')?.value) || 1,
                    enabled: alertEl.querySelector('.alert-enabled')?.checked || false
                });
            });
        }
        const rotationEnabledCheckbox = el.querySelector('.rotation-enabled');
        const durationMin = parseInt(el.querySelector('.round-duration-min')?.value) || 0;
        const durationSec = parseInt(el.querySelector('.round-duration-sec')?.value) || 0;
        const round = {
            type: type,
            roundName: el.querySelector('.round-round-name')?.value || '',
            duration: durationMin * 60 + durationSec || 10,
            alerts: alerts,
            rotationEnabled: type === 'round' ? (rotationEnabledCheckbox?.checked || false) : false,
            rotationInterval: type === 'round' ? (parseInt(el.querySelector('.round-rotation-interval')?.value) || 30) : 0
        };
        rounds.push(round);
    });

    const voicePack = document.querySelector('input[name="voice-pack"]:checked')?.value || 'zh';

    return {
        eventName: elements.globalEventName.value,
        rounds: rounds,
        voicePack: voicePack,
        bgColor: elements.bgColor.value,
        textColor: elements.textColor.value,
        fontFamily: elements.fontFamily.value,
        eventNameSize: parseInt(elements.eventNameSize.value) || 45,
        roundNameSize: parseInt(elements.roundNameSize.value) || 35,
        timerSize: parseInt(elements.timerSize.value) || 250
    };
}

// 保存设置
function saveSettings() {
    config = readConfigFromForm();
    localStorage.setItem('sudokuTimerConfig', JSON.stringify(config));
    showToast('设置已保存');
}

// 加载配置
function loadConfig() {
    const saved = localStorage.getItem('sudokuTimerConfig');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            config = { ...DEFAULT_CONFIG, ...parsed };
        } catch (e) {
            console.error('加载配置失败:', e);
        }
    }
}

// 更新 UI
function updateUI() {
    const voicePackRadio = document.querySelector(`input[name="voice-pack"][value="${config.voicePack}"]`);
    if (voicePackRadio) voicePackRadio.checked = true;

    elements.bgColor.value = config.bgColor;
    elements.textColor.value = config.textColor;
    elements.fontFamily.value = config.fontFamily;
    elements.eventNameSize.value = config.eventNameSize;
    elements.eventNameSizeValue.textContent = config.eventNameSize + 'px';
    elements.roundNameSize.value = config.roundNameSize;
    elements.roundNameSizeValue.textContent = config.roundNameSize + 'px';
    elements.timerSize.value = config.timerSize;
    elements.timerSizeValue.textContent = config.timerSize + 'px';
}

// 恢复默认设置
function resetDefaults() {
    if (confirm('确定要恢复默认设置吗？')) {
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        audioBuffers = {};
        isAudioPreloaded = false;
        renderRounds();
        updateUI();
        updateAudioStatus('pending', '请先加载语音包');
        localStorage.removeItem('sudokuTimerConfig');
        showToast('已恢复默认设置');
    }
}

// 开始计时
async function startTimer() {
    config = readConfigFromForm();

    if (config.rounds.length === 0) {
        showToast('请至少添加一个轮次', 'error');
        return;
    }

    for (let i = 0; i < config.rounds.length; i++) {
        if (config.rounds[i].duration < 1 || config.rounds[i].duration > 180 * 60) {
            showToast(`第${i + 1}项时长不能为空`, 'error');
            return;
        }
    }

    warmupAudio();

    if (!isAudioPreloaded) {
        updateAudioStatus('loading', '正在加载音频...');
        try {
            await loadVoicePack();
        } catch (error) {
            showToast('音频加载失败', 'error');
            return;
        }
    }

    currentRoundIndex = 0;
    startRound(currentRoundIndex);
}

// 预览计时器界面
function previewTimer() {
    config = readConfigFromForm();

    if (config.rounds.length === 0) {
        showToast('请至少添加一个轮次', 'error');
        return;
    }

    for (let i = 0; i < config.rounds.length; i++) {
        if (config.rounds[i].duration < 1 || config.rounds[i].duration > 180 * 60) {
            showToast(`第${i + 1}项时长不能为空`, 'error');
            return;
        }
    }

    // 进入第一个轮次的预览状态
    const round = config.rounds[0];
    totalDuration = round.duration;
    remainingSeconds = totalDuration;
    isPaused = true;
    isPreview = true;
    currentRoundIndex = 0;
    alertedTimes.clear();
    lastRotationAlert = 0;
    startTime = Date.now();
    pausedElapsed = 0;

    updateTimerDisplay();
    applyStyles();
    updateProgressBar();

    elements.editPanel.classList.add('hidden');
    elements.timerDisplay.classList.remove('hidden');

    elements.pauseBtn.classList.add('hidden');
    elements.resumeBtn.classList.remove('hidden');
    elements.resumeBtn.textContent = '开始';

    // 显示下一轮信息（如果有）
    if (config.rounds.length > 1) {
        elements.nextRoundInfo.classList.remove('hidden');
        elements.nextRoundName.textContent = config.rounds[1].roundName;
    } else {
        elements.nextRoundInfo.classList.add('hidden');
    }

    document.title = `${round.roundName} - 准备开始`;
}

// 开始指定轮次（从预览或直接开始）
function startRound(index) {
    if (index >= config.rounds.length) {
        showToast('所有轮次已完成');
        exitTimer();
        return;
    }

    const round = config.rounds[index];
    totalDuration = round.duration;
    remainingSeconds = totalDuration;
    isPaused = false;
    alertedTimes.clear();
    lastRotationAlert = 0;
    startTime = Date.now();
    pausedElapsed = 0;

    updateTimerDisplay();
    applyStyles();
    updateProgressBar();

    elements.editPanel.classList.add('hidden');
    elements.timerDisplay.classList.remove('hidden');

    if (index < config.rounds.length - 1) {
        elements.nextRoundInfo.classList.remove('hidden');
        elements.nextRoundName.textContent = config.rounds[index + 1].roundName;
    } else {
        elements.nextRoundInfo.classList.add('hidden');
    }

    startInterval();
}

// 应用样式
function applyStyles() {
    elements.timerDisplay.style.backgroundColor = config.bgColor;
    elements.timerDisplay.style.color = config.textColor;
    elements.timerDisplay.style.fontFamily = config.fontFamily;
    elements.timer.style.fontSize = config.timerSize + 'px';
    elements.displayEventName.style.fontFamily = config.fontFamily;
    elements.displayRoundName.style.fontFamily = config.fontFamily;
    elements.displayEventName.style.fontSize = config.eventNameSize + 'px';
    elements.displayRoundName.style.fontSize = config.roundNameSize + 'px';
}

// 更新倒计时显示
function updateTimerDisplay() {
    const round = config.rounds[currentRoundIndex];
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    elements.timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    elements.displayEventName.textContent = config.eventName;
    elements.displayRoundName.textContent = round.roundName;
    document.title = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} - ${round.roundName}`;
}

// 更新进度条
function updateProgressBar() {
    const progress = totalDuration > 0 ? (remainingSeconds / totalDuration) * 100 : 0;
    elements.progressFill.style.width = progress + '%';
    elements.progressFill.classList.remove('warning', 'danger');
    if (remainingSeconds <= 30 && remainingSeconds > 0) {
        elements.progressFill.classList.add('danger');
    } else if (remainingSeconds <= 60 && remainingSeconds > 30) {
        elements.progressFill.classList.add('warning');
    }
}

// 启动定时器
function startInterval() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    startTime = Date.now();
    let lastReportedSecond = totalDuration;

    timerInterval = setInterval(() => {
        if (!isPaused) {
            const elapsedSeconds = Math.floor((Date.now() - startTime - pausedElapsed) / 1000);
            const currentSecond = totalDuration - elapsedSeconds;
            
            if (currentSecond !== lastReportedSecond && currentSecond >= 0) {
                remainingSeconds = currentSecond;
                lastReportedSecond = currentSecond;
                
                updateTimerDisplay();
                updateProgressBar();
                checkAlerts();

                if (remainingSeconds <= 0) {
                    finishRound();
                }
            }
        }
    }, 100);
}

// 检查提醒
function checkAlerts() {
    const round = config.rounds[currentRoundIndex];
    if (round.type === 'break') return;

    const minutes = Math.floor((remainingSeconds - 1) / 60);
    const totalElapsed = totalDuration - remainingSeconds;

    const alerts = round.alerts || [];
    alerts.forEach(alert => {
        if (!alert.enabled) return;
        
        const alertKey = `alert-${alert.minutes}`;
        if (minutes === alert.minutes && (remainingSeconds - 1) % 60 === 0 && !alertedTimes.has(alertKey)) {
            alertedTimes.add(alertKey);
            
            // 优先使用本地音频，如果不存在则使用语音合成
            const hasLocalAudio = audioElements[alert.minutes] !== undefined;
            const isEnglish = config.voicePack.startsWith('en');
            
            if (hasLocalAudio) {
                playAudio(alert.minutes);
            } else {
                const text = isEnglish 
                    ? `${alert.minutes} minutes left` 
                    : `剩余${alert.minutes}分钟`;
                speakText(text, isEnglish);
            }
        }
    });

    const rotationEnabled = round.rotationEnabled || false;
    const rotationInterval = round.rotationInterval || 30;
    if (rotationEnabled && rotationInterval > 0 && remainingSeconds > 1 && totalElapsed > 0 && (totalElapsed + 1) % rotationInterval === 0 && totalElapsed !== lastRotationAlert) {
        lastRotationAlert = totalElapsed;
        
        // 检查是否有本地轮转音频
        if (audioElements['rotation']) {
            playAudio('rotation');
        } else {
            const isEnglish = config.voicePack.startsWith('en');
            const text = isEnglish ? 'Turn' : '转';
            speakText(text, isEnglish);
        }
    }

    if (remainingSeconds === 1) {
        // 检查是否有本地结束音频
        if (audioElements['end']) {
            playAudio('end');
        } else {
            const isEnglish = config.voicePack.startsWith('en');
            const text = isEnglish ? "Time's up" : '时间到';
            speakText(text, isEnglish);
        }
    }

    if (remainingSeconds <= 30 && remainingSeconds > 0) {
        elements.timer.classList.add('warning');
    } else {
        elements.timer.classList.remove('warning');
    }
}

// 添加警告样式
function addWarningClass() {
    elements.timer.classList.add('warning');
    setTimeout(() => {
        elements.timer.classList.remove('warning');
    }, 3000);
}

// 轮次结束
function finishRound() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    elements.timer.classList.add('finished');

    setTimeout(() => {
        elements.timer.classList.remove('finished');
        currentRoundIndex++;
        startRound(currentRoundIndex);
    }, 3000);
}

// 跳过当前轮次
function skipRound() {
    if (confirm('确定要跳过当前轮次吗？')) {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        elements.timer.classList.remove('warning', 'finished');
        currentRoundIndex++;
        startRound(currentRoundIndex);
    }
}

// 暂停计时
function pauseTimer() {
    isPaused = true;
    pausedAt = Date.now();
    elements.pauseBtn.classList.add('hidden');
    elements.resumeBtn.classList.remove('hidden');
}

// 继续计时
function resumeTimer() {
    if (isPreview) {
        isPreview = false;
        isPaused = false; // 关键：需要设置 isPaused = false 才能开始计时
        warmupAudio();
        
        if (!isAudioPreloaded) {
            updateAudioStatus('loading', '正在加载音频...');
            loadVoicePack().then(() => {
                startInterval();
            }).catch(error => {
                showToast('音频加载失败', 'error');
                startInterval();
            });
        } else {
            startInterval();
        }
        
        elements.pauseBtn.classList.remove('hidden');
        elements.resumeBtn.classList.add('hidden');
        return;
    }
    
    if (isPaused) {
        pausedElapsed += Date.now() - pausedAt;
    }
    isPaused = false;
    elements.pauseBtn.classList.remove('hidden');
    elements.resumeBtn.classList.add('hidden');
}

// 停止计时
function stopTimer() {
    if (confirm('确定要停止所有计时吗？')) {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        remainingSeconds = 0;
        currentRoundIndex = 0;
        pausedElapsed = 0;
        updateTimerDisplay();
        elements.timer.classList.remove('warning', 'finished');
    }
}

// 退出计时器
function exitTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
    isPaused = false;
    isPreview = false;
    remainingSeconds = 0;
    currentRoundIndex = 0;
    pausedElapsed = 0;
    elements.timer.classList.remove('warning', 'finished');
    elements.timerDisplay.classList.add('hidden');
    elements.editPanel.classList.remove('hidden');
    elements.pauseBtn.classList.remove('hidden');
    elements.resumeBtn.classList.add('hidden');
    elements.resumeBtn.textContent = '继续';
    elements.nextRoundInfo.classList.add('hidden');
    document.title = '数独比赛计时器';
}

// 切换全屏
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        elements.timerDisplay.requestFullscreen().catch(err => {
            showToast('无法进入全屏模式', 'error');
        });
    } else {
        document.exitFullscreen();
    }
}

// 键盘快捷键
function handleKeyboard(e) {
    if (elements.timerDisplay.classList.contains('hidden')) return;

    switch (e.key) {
        case ' ':
            e.preventDefault();
            isPaused ? resumeTimer() : pauseTimer();
            break;
        case 'Escape':
            exitTimer();
            break;
        case 'f':
        case 'F':
            toggleFullscreen();
            break;
        case 's':
        case 'S':
            skipRound();
            break;
    }
}

// 显示提示消息
function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}
