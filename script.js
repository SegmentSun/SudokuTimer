// 数独比赛计时器

// 默认配置
const DEFAULT_CONFIG = {
    eventName: '2026全国数独锦标赛',
    rounds: [
        { type: 'round', roundName: '第一轮', duration: 30, alertType: 'normal', rotationInterval: 30 }
    ],
    voicePack: 'zh',
    bgColor: '#2c3e50',
    textColor: '#ffffff',
    fontFamily: "system-ui, -apple-system, sans-serif",
    eventNameSize: 45,
    roundNameSize: 35,
    timerSize: 250
};

// 音频文件映射
const AUDIO_FILES = {
    zh: {
        '5min': 'audios/zh/剩余五分钟.mp3',
        '1min': 'audios/zh/剩余一分钟.mp3',
        'end': 'audios/zh/时间到.mp3',
        'rotation': 'audios/zh/转.mp3'
    },
    en: {
        '5min': 'audios/en/5_minutes_left.mp3',
        '1min': 'audios/en/1_minute_left.mp3',
        'end': 'audios/en/Time\'s_up.mp3',
        'rotation': 'audios/en/Turn.mp3'
    }
};

// 全局状态
let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let audioContext = null;
let audioElements = {}; // HTML5 Audio 元素
let audioSources = {}; // Web Audio source 节点
let currentRoundIndex = 0;
let timerInterval = null;
let remainingSeconds = 0;
let isPaused = false;
let alertedTimes = new Set();
let lastRotationAlert = 0;
let totalDuration = 0;
let isAudioPreloaded = false;
let startTime = Date.now();
let pausedElapsed = 0;
let pausedAt = 0;

// DOM 元素引用
const elements = {};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    loadConfig();
    bindEvents();
    renderRounds();
    updateUI();
    updateAudioStatus('pending', '请先加载语音包');
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

// 加载语音包 - 使用 HTML5 Audio
async function loadVoicePack() {
    try {
        const voicePack = document.querySelector('input[name="voice-pack"]:checked')?.value || 'zh';
        config.voicePack = voicePack;

        console.log('开始加载语音包:', voicePack);

        updateAudioStatus('loading', '正在加载音频...');

        const files = AUDIO_FILES[voicePack];
        console.log('音频文件列表:', files);
        
        // 逐个加载音频
        for (const [key, path] of Object.entries(files)) {
            console.log(`加载中: ${key} - ${path}`);
            
            try {
                const audio = new Audio();
                
                // 使用 Promise 包装 load 事件
                await new Promise((resolve, reject) => {
                    audio.addEventListener('canplaythrough', resolve);
                    audio.addEventListener('error', reject);
                    audio.src = path;
                    audio.load();
                });
                
                audioElements[key] = audio;
                console.log(`已加载: ${key}, 时长: ${audio.duration}秒`);
                
                // 每个音频加载后稍作延迟
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (err) {
                console.error(`加载失败: ${key}`, err);
            }
        }
        
        isAudioPreloaded = true;
        updateAudioStatus('ready', '音频已就绪');
        showToast('语音包加载完成');
        
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
        alertType: 'normal',
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
        const roundEl = document.createElement('div');
        roundEl.className = `round-item ${round.type}`;
        
        const typeLabel = round.type === 'round' ? '比赛轮次' : '场间休息';
        
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
                <div class="form-group">
                    <label>时长（分钟）</label>
                    <input type="number" class="round-duration" value="${round.duration}" min="1" max="180">
                </div>
                ${round.type === 'round' ? `
                    <div class="form-group">
                        <label>提醒类型</label>
                        <select class="round-alert-type">
                            <option value="normal" ${round.alertType === 'normal' ? 'selected' : ''}>常规轮次（5分/1分提醒）</option>
                            <option value="rotation" ${round.alertType === 'rotation' ? 'selected' : ''}>轮转模式</option>
                        </select>
                    </div>
                    <div class="form-group rotation-settings" style="${round.alertType !== 'rotation' ? 'display:none' : ''}">
                        <label>轮转间隔（秒）</label>
                        <input type="number" class="round-rotation-interval" value="${round.rotationInterval}" min="1" max="300">
                    </div>
                ` : ''}
            </div>
        `;

        elements.roundsContainer.appendChild(roundEl);

        roundEl.querySelector('.remove-round').addEventListener('click', () => removeRound(index));

        const alertTypeSelect = roundEl.querySelector('.round-alert-type');
        if (alertTypeSelect) {
            alertTypeSelect.addEventListener('change', (e) => {
                const rotationSettings = roundEl.querySelector('.rotation-settings');
                rotationSettings.style.display = e.target.value === 'rotation' ? 'block' : 'none';
            });
        }
    });
}

// 为轮次输入框绑定事件，确保输入内容即时保存到 config
function bindRoundInputEvents() {
    const roundItems = document.querySelectorAll('.round-item');
    roundItems.forEach((roundEl, index) => {
        const roundNameInput = roundEl.querySelector('.round-round-name');
        const durationInput = roundEl.querySelector('.round-duration');
        const alertTypeSelect = roundEl.querySelector('.round-alert-type');
        const rotationIntervalInput = roundEl.querySelector('.round-rotation-interval');

        if (roundNameInput) {
            roundNameInput.addEventListener('input', (e) => {
                config.rounds[index].roundName = e.target.value;
            });
        }

        if (durationInput) {
            durationInput.addEventListener('input', (e) => {
                config.rounds[index].duration = parseInt(e.target.value) || 1;
            });
        }

        if (alertTypeSelect) {
            alertTypeSelect.addEventListener('change', (e) => {
                config.rounds[index].alertType = e.target.value;
                renderRounds(); // 重新渲染以更新轮转间隔输入框的显示状态
            });
        }

        if (rotationIntervalInput) {
            rotationIntervalInput.addEventListener('input', (e) => {
                config.rounds[index].rotationInterval = parseInt(e.target.value) || 1;
            });
        }
    });
}

// 从表单读取配置
function readConfigFromForm() {
    const rounds = [];
    document.querySelectorAll('.round-item').forEach((el) => {
        const type = el.classList.contains('break') ? 'break' : 'round';
        const round = {
            type: type,
            roundName: el.querySelector('.round-round-name')?.value || '',
            duration: parseInt(el.querySelector('.round-duration')?.value) || 10,
            alertType: type === 'round' ? (el.querySelector('.round-alert-type')?.value || 'normal') : 'normal',
            rotationInterval: type === 'round' ? (parseInt(el.querySelector('.round-rotation-interval')?.value) || 30) : 30
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
        if (config.rounds[i].duration < 1 || config.rounds[i].duration > 180) {
            showToast(`第${i + 1}项时长必须在 1-180 分钟之间`, 'error');
            return;
        }
    }

    // 在用户点击时预热 AudioContext
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

// 开始指定轮次
function startRound(index) {
    if (index >= config.rounds.length) {
        showToast('所有轮次已完成');
        exitTimer();
        return;
    }

    const round = config.rounds[index];
    totalDuration = round.duration * 60;
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

    const minutes = Math.floor((remainingSeconds - 1) / 60); // 提前 1 秒计算提醒时间
    const totalElapsed = totalDuration - remainingSeconds;

    if (round.alertType === 'normal') {
        if (minutes === 5 && (remainingSeconds - 1) % 60 === 0 && !alertedTimes.has(5)) {
            alertedTimes.add(5);
            playAudio('5min');
        }
        if (minutes === 1 && (remainingSeconds - 1) % 60 === 0 && !alertedTimes.has(1)) {
            alertedTimes.add(1);
            playAudio('1min');
        }
    } else {
        const interval = round.rotationInterval;
        if (remainingSeconds > 1 && totalElapsed > 0 && (totalElapsed + 1) % interval === 0 && totalElapsed !== lastRotationAlert) {
            lastRotationAlert = totalElapsed;
            playAudio('rotation');
        }
    }
    if(remainingSeconds === 1){
        playAudio('end');
    }

    if (remainingSeconds <= 30 && remainingSeconds > 0) {
        elements.timer.classList.add('warning');
    }
    else{
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
    remainingSeconds = 0;
    currentRoundIndex = 0;
    pausedElapsed = 0;
    elements.timer.classList.remove('warning', 'finished');
    elements.timerDisplay.classList.add('hidden');
    elements.editPanel.classList.remove('hidden');
    elements.pauseBtn.classList.remove('hidden');
    elements.resumeBtn.classList.add('hidden');
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
