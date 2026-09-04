document.addEventListener('DOMContentLoaded', () => {
    
    // --- Global Utility ---
    const alarmAudio = document.getElementById('alarm-audio');
    const alarmModal = document.getElementById('alarm-trigger-modal');
    const alarmTitle = document.getElementById('alarm-trigger-title');
    const dismissAlarmBtn = document.getElementById('dismiss-alarm-btn');
    
    function playAlarm(title = "Alarm!") {
        if (alarmAudio) {
            alarmAudio.currentTime = 0;
            alarmAudio.play().catch(e => console.log('Audio play failed', e));
        }
        if (alarmModal && alarmTitle) {
            alarmTitle.textContent = title;
            alarmModal.style.display = 'flex';
        }
    }

    if (dismissAlarmBtn) {
        dismissAlarmBtn.addEventListener('click', () => {
            if (alarmAudio) {
                alarmAudio.pause();
                alarmAudio.currentTime = 0;
            }
            alarmModal.style.display = 'none';
        });
    }

    function showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="ri-check-line"></i> ${message}`;
        container.appendChild(toast);
        setTimeout(() => {
            if(toast.parentElement) toast.remove();
        }, 3000);
    }

    function formatTime(seconds) {
        let mins = Math.floor(seconds / 60);
        let secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    if ("Notification" in window) {
        Notification.requestPermission();
    }
    
    function sendNotification(title, body) {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body: body, icon: 'https://cdn-icons-png.flaticon.com/512/3233/3233515.png' });
        }
    }

    // --- State Management & Persistence ---
    let currentUser = null;
    let syncTimeout = null;

    const Storage = {
        get: (key, defaultVal) => {
            try { const data = localStorage.getItem(key); return data ? JSON.parse(data) : defaultVal; } catch(e) { return defaultVal; }
        },
        set: (key, val) => {
            localStorage.setItem(key, JSON.stringify(val));
            if (currentUser && window.firebaseInitialized) {
                clearTimeout(syncTimeout);
                syncTimeout = setTimeout(() => {
                    if (window.fbSetDoc && window.fbDoc && window.fbDb) {
                        window.fbSetDoc(window.fbDoc(window.fbDb, "users", currentUser.uid), STATE, { merge: true })
                            .catch(err => console.error("Firebase sync error:", err));
                    }
                }, 2000);
            }
        }
    };

    const STATE = {
        studyMins: Storage.get('studyMins', 0),
        waterIntake: Storage.get('waterIntake', 0),
        meals: Storage.get('meals', [{name: 'Oatmeal & Berries', type: 'Breakfast', cals: 350, pro: 10, carbs: 45}, {name: 'Grilled Chicken Salad', type: 'Lunch', cals: 450, pro: 35, carbs: 15}]),
        studyLogs: Storage.get('studyLogs', []),
        studyTopics: Storage.get('studyTopics', ['Python Logic', 'C Exercises', 'Data Science', 'Biology']),
        customTasks: Storage.get('customTasks', []),
        events: Storage.get('events', {}),
        exercises: Storage.get('exercises', [
            { id: 1, name: 'Bench Press', sets: '4x8-10', completed: false },
            { id: 2, name: 'Overhead Press', sets: '3x10-12', completed: false },
            { id: 3, name: 'Tricep Extensions', sets: '3x12-15', completed: false }
        ]),
        streak: Storage.get('streak', [false, false, false, false, false, false, false]),
        deadlines: Storage.get('deadlines', [
            { id: 1, name: 'Data Structures Exam', date: 'Tomorrow', urgent: true, completed: false },
            { id: 2, name: 'Python Project', date: 'In 3 days', urgent: false, completed: false }
        ]),
        hiddenWidgets: Storage.get('hiddenWidgets', []),
        mood: Storage.get('mood', null),
        scratchpadText: Storage.get('scratchpadText', ''),
        
        // Configurable Goals & Defaults
        calGoal: Storage.get('calGoal', 2200),
        proGoal: Storage.get('proGoal', 150),
        carbGoal: Storage.get('carbGoal', 200),
        waterGoal: Storage.get('waterGoal', 2000),
        defaultFocusTime: Storage.get('defaultFocusTime', 25),
        defaultBreakTime: Storage.get('defaultBreakTime', 5),
        alarmSound: Storage.get('alarmSound', 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
    };

    const todayStr = new Date().toDateString();
    const lastLogin = Storage.get('lastLoginDate', todayStr);
    
    if (lastLogin !== todayStr) {
        STATE.studyMins = 0;
        STATE.waterIntake = 0;
        STATE.studyLogs = [];
        STATE.exercises.forEach(e => e.completed = false);
        Storage.set('lastLoginDate', todayStr);
        // Custom tasks are kept but not deleted automatically unless completed (optional logic)
    } else {
        Storage.set('lastLoginDate', todayStr);
    }

    function saveState() {
        Storage.set('studyMins', STATE.studyMins);
        Storage.set('waterIntake', STATE.waterIntake);
        Storage.set('meals', STATE.meals);
        Storage.set('studyLogs', STATE.studyLogs);
        Storage.set('studyTopics', STATE.studyTopics);
        Storage.set('customTasks', STATE.customTasks);
        Storage.set('events', STATE.events);
        Storage.set('exercises', STATE.exercises);
        Storage.set('streak', STATE.streak);
        Storage.set('deadlines', STATE.deadlines);
        Storage.set('alarms', STATE.alarms);
        
        Storage.set('hiddenWidgets', STATE.hiddenWidgets);
        Storage.set('mood', STATE.mood);
        Storage.set('scratchpadText', STATE.scratchpadText);
        
        Storage.set('calGoal', STATE.calGoal);
        Storage.set('proGoal', STATE.proGoal);
        Storage.set('carbGoal', STATE.carbGoal);
        Storage.set('waterGoal', STATE.waterGoal);
        Storage.set('defaultFocusTime', STATE.defaultFocusTime);
        Storage.set('defaultBreakTime', STATE.defaultBreakTime);
        Storage.set('alarmSound', STATE.alarmSound);
        
        updateDashboardRings();
    }

    // --- Apply Personalization ---
    function applyPersonalization() {
        // Apply single theme classes if necessary (we use standard CSS now)

        if (STATE.customColor) {
            document.documentElement.style.setProperty('--accent', STATE.customColor);
            document.documentElement.style.setProperty('--accent-glow', STATE.customColor + '66');
            const picker = document.getElementById('custom-color-picker');
            if(picker) picker.value = STATE.customColor;
        } else {
            document.documentElement.style.removeProperty('--accent');
            document.documentElement.style.removeProperty('--accent-glow');
        }

        const dynamicBg = document.getElementById('dynamic-bg');
        if (STATE.customBg && dynamicBg) {
            dynamicBg.style.backgroundImage = `url('${STATE.customBg}')`;
            dynamicBg.style.backgroundSize = 'cover';
            dynamicBg.style.backgroundPosition = 'center';
            const urlInput = document.getElementById('custom-bg-url');
            if(urlInput) urlInput.value = STATE.customBg;
            document.querySelectorAll('.blob').forEach(b => b.style.display = 'none');
        } else if(dynamicBg) {
            dynamicBg.style.backgroundImage = '';
            document.querySelectorAll('.blob').forEach(b => b.style.display = 'block');
            const urlInput = document.getElementById('custom-bg-url');
            if(urlInput) urlInput.value = '';
        }

        // Widget visibility
        const allWidgets = [
            'progress-widget', 'trend-widget', 'scratchpad-widget', 
            'alarms-widget', 'deadlines-widget', 'macros-widget', 'exercises-widget'
        ];
        allWidgets.forEach(id => {
            const w = document.getElementById(id);
            if (w) {
                if (STATE.hiddenWidgets.includes(id)) {
                    w.classList.add('hidden-widget');
                } else {
                    w.classList.remove('hidden-widget');
                }
            }
            // Update the checkboxes in settings modal
            const checkbox = document.querySelector(`input[data-widget="${id}"]`);
            if (checkbox) {
                checkbox.checked = !STATE.hiddenWidgets.includes(id);
            }
        });

        // Populate new settings inputs
        const calInput = document.getElementById('setting-cal-goal');
        if (calInput) calInput.value = STATE.calGoal;
        const proInput = document.getElementById('setting-pro-goal');
        if (proInput) proInput.value = STATE.proGoal;
        const carbInput = document.getElementById('setting-carb-goal');
        if (carbInput) carbInput.value = STATE.carbGoal;
        const waterInput = document.getElementById('setting-water-goal');
        if (waterInput) waterInput.value = STATE.waterGoal;
        
        const focusInput = document.getElementById('setting-focus-time');
        if (focusInput) focusInput.value = STATE.defaultFocusTime;
        const breakInput = document.getElementById('setting-break-time');
        if (breakInput) breakInput.value = STATE.defaultBreakTime;
        
        const soundSelect = document.getElementById('setting-alarm-sound');
        if (soundSelect) soundSelect.value = STATE.alarmSound;
        
        // Mood Tracking
        const emojis = document.querySelectorAll('#mood-emojis span');
        emojis.forEach(e => e.classList.remove('selected'));
        const greeting = document.getElementById('greeting-text');
        const name = Storage.get('user_name', 'Explorer');
        
        if (STATE.mood) {
            const selected = document.querySelector(`#mood-emojis span[data-mood="${STATE.mood}"]`);
            if(selected) selected.classList.add('selected');
            
            let prefix = "Good Morning";
            const hr = new Date().getHours();
            if(hr >= 12 && hr < 17) prefix = "Good Afternoon";
            else if(hr >= 17) prefix = "Good Evening";
            
            let moodText = "";
            if(STATE.mood === 'sad') moodText = "Hope your day gets better";
            if(STATE.mood === 'neutral') moodText = "Ready to focus";
            if(STATE.mood === 'good') moodText = "Having a good day";
            if(STATE.mood === 'great') moodText = "Feeling great";
            if(STATE.mood === 'awesome') moodText = "On top of the world";
            
            if(greeting) greeting.textContent = `${prefix}, ${name}. ${moodText}!`;
        }
    }


    // --- Dashboard Updates ---
    function updateDashboardRings() {
        const setRing = (idPrefix, percentage) => {
            const path = document.getElementById(`${idPrefix}-ring-path`);
            const text = document.getElementById(`${idPrefix}-ring-text`);
            if(path && text) {
                const p = Math.min(Math.max(Math.round(percentage), 0), 100);
                path.setAttribute('stroke-dasharray', `${p}, 100`);
                text.textContent = `${p}%`;
            }
        };

        const studyP = (STATE.studyMins / 120) * 100;
        setRing('study', studyP);

        const waterP = (STATE.waterIntake / STATE.waterGoal) * 50;
        const mealsP = Math.min(STATE.meals.length / 4, 1) * 50;
        setRing('diet', waterP + mealsP);

        const totalEx = STATE.exercises.length;
        const compEx = STATE.exercises.filter(e => e.completed).length;
        const exP = totalEx > 0 ? (compEx / totalEx) * 100 : 0;
        setRing('exercise', exP);
        
        renderTrendChart();
    }

    function renderTrendChart() {
        const trendBars = document.querySelectorAll('#weekly-chart-bars .chart-bar');
        if (trendBars.length === 7) {
            trendBars.forEach((bar, index) => {
                if (STATE.streak[index]) {
                    bar.style.height = '100%';
                } else {
                    bar.style.height = '10%';
                }
            });
        }
    }

    // --- 1. Date Display & Clock ---
    const dateDisplay = document.getElementById('current-date');
    if (dateDisplay) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const today = new Date();
        dateDisplay.textContent = today.toLocaleDateString('en-US', options);
    }

    const clockDisplay = document.getElementById('real-time-clock');
    if (clockDisplay) {
        setInterval(() => {
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            clockDisplay.textContent = timeString;
            
            // Check alarms (only once per minute to avoid multiple triggers, we track 'lastTriggered' in STATE or just check seconds)
            if (now.getSeconds() === 0) {
                const currentHm = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                STATE.alarms.forEach(alarm => {
                    if (alarm.active && alarm.time === currentHm) {
                        playAlarm(alarm.label || "Alarm!");
                        sendNotification("Alarm!", alarm.label);
                        // Optionally disable alarm after it rings
                        // alarm.active = false; 
                    }
                });
            }
        }, 1000);
        clockDisplay.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // --- 2. Theme Switching & Customization Hooks ---
    const themeBtns = document.querySelectorAll('.theme-btn');
    const htmlEl = document.documentElement;

    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const theme = btn.getAttribute('data-theme');
            htmlEl.setAttribute('data-theme', theme);
            showToast(`Theme changed to ${theme}`);
        });
    });

    const customColorPicker = document.getElementById('custom-color-picker');
    if (customColorPicker) {
        customColorPicker.addEventListener('input', (e) => {
            STATE.customColor = e.target.value;
            saveState();
            applyPersonalization();
        });
    }

    const customBgUrl = document.getElementById('custom-bg-url');
    if (customBgUrl) {
        customBgUrl.addEventListener('change', (e) => {
            STATE.customBg = e.target.value;
            saveState();
            applyPersonalization();
        });
    }

    const clearBgBtn = document.getElementById('clear-bg-btn');
    if(clearBgBtn) {
        clearBgBtn.addEventListener('click', () => {
            STATE.customBg = null;
            saveState();
            applyPersonalization();
            showToast("Custom background cleared");
        });
    }

    const widgetToggles = document.getElementById('widget-toggles');
    if (widgetToggles) {
        widgetToggles.addEventListener('change', (e) => {
            if (e.target.tagName === 'INPUT') {
                const widgetId = e.target.getAttribute('data-widget');
                if (e.target.checked) {
                    STATE.hiddenWidgets = STATE.hiddenWidgets.filter(id => id !== widgetId);
                } else {
                    if (!STATE.hiddenWidgets.includes(widgetId)) {
                        STATE.hiddenWidgets.push(widgetId);
                    }
                }
                saveState();
                applyPersonalization();
            }
        });
    }

    // Settings Inputs Listeners
    const updateGoal = (id, stateKey) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) {
                    STATE[stateKey] = val;
                    saveState();
                    showToast("Setting saved!");
                    
                    // If it's a diet goal, try to update UI immediately
                    if (['calGoal', 'proGoal', 'carbGoal'].includes(stateKey) && typeof updateDietUI === 'function') {
                        updateDietUI();
                    } else if (stateKey === 'waterGoal') {
                        updateDashboardRings();
                    }
                }
            });
        }
    };

    updateGoal('setting-cal-goal', 'calGoal');
    updateGoal('setting-pro-goal', 'proGoal');
    updateGoal('setting-carb-goal', 'carbGoal');
    updateGoal('setting-water-goal', 'waterGoal');
    
    // Timer Defaults Listeners
    const focusTimeInput = document.getElementById('setting-focus-time');
    if (focusTimeInput) {
        focusTimeInput.addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val > 0) {
                STATE.defaultFocusTime = val;
                saveState();
                showToast("Default Focus Time saved! It will apply to new sessions.");
            }
        });
    }

    const breakTimeInput = document.getElementById('setting-break-time');
    if (breakTimeInput) {
        breakTimeInput.addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val > 0) {
                STATE.defaultBreakTime = val;
                saveState();
                showToast("Default Break Time saved!");
            }
        });
    }

    // Alarm Sound Listener
    const alarmSoundSelect = document.getElementById('setting-alarm-sound');
    if (alarmSoundSelect) {
        alarmSoundSelect.addEventListener('change', (e) => {
            STATE.alarmSound = e.target.value;
            saveState();
            const audioEl = document.getElementById('alarm-audio');
            if (audioEl) {
                audioEl.src = STATE.alarmSound;
            }
            showToast("Alarm sound updated!");
        });
    }

    const moodEmojis = document.getElementById('mood-emojis');
    if (moodEmojis) {
        moodEmojis.addEventListener('click', (e) => {
            if(e.target.tagName === 'SPAN') {
                STATE.mood = e.target.getAttribute('data-mood');
                saveState();
                applyPersonalization();
                showToast("Mood logged!");
            }
        });
    }



    // --- Zen Mode ---
    const zenBtn = document.getElementById('zen-mode-btn');
    if (zenBtn) {
        const exitBtn = document.createElement('button');
        exitBtn.className = 'glass-btn primary zen-mode-exit-btn';
        exitBtn.innerHTML = '<i class="ri-focus-2-line"></i> Exit Zen Mode';
        document.body.appendChild(exitBtn);

        zenBtn.addEventListener('click', () => {
            document.body.classList.add('zen-mode');
            showToast("Zen Mode Activated. Press Esc to exit.");
        });

        exitBtn.addEventListener('click', () => {
            document.body.classList.remove('zen-mode');
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('zen-mode')) {
                document.body.classList.remove('zen-mode');
            }
        });
    }

    // --- 3. Navigation ---
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const sidebar = document.getElementById('sidebar');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (item.classList.contains('active')) return;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            pages.forEach(page => page.classList.remove('active-page'));
            
            const targetId = item.getAttribute('data-target');
            const targetPage = document.getElementById(targetId);
            if (targetPage) {
                targetPage.classList.add('active-page');
            }

            if (window.innerWidth <= 768 && sidebar) {
                sidebar.classList.remove('active');
            }
        });
    });

    const menuBtn = document.getElementById('menu-btn');
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // --- 4. Study Planner Interactivity ---
    // Pomodoro Timer
    const timeLeft = document.getElementById('time-left');
    const playBtn = document.getElementById('timer-play');
    const stopBtn = document.getElementById('timer-stop');
    const skipBtn = document.getElementById('timer-skip');
    const setTimerBtn = document.getElementById('set-timer-btn');
    const pomodoroInput = document.getElementById('pomodoro-input');
    
    let timerInterval;
    let isRunning = false;
    let defaultTime = STATE.defaultFocusTime * 60;
    let time = defaultTime;

    if (pomodoroInput) {
        pomodoroInput.value = STATE.defaultFocusTime;
    }
    if (timeLeft) {
        timeLeft.textContent = formatTime(time);
    }

    if (setTimerBtn && pomodoroInput) {
        setTimerBtn.addEventListener('click', () => {
            if (!isRunning) {
                let mins = parseInt(pomodoroInput.value, 10);
                if (!isNaN(mins) && mins > 0) {
                    defaultTime = mins * 60;
                    time = defaultTime;
                    timeLeft.textContent = formatTime(time);
                    showToast(`Timer set to ${mins} minutes`);
                }
            } else {
                showToast("Cannot change time while running");
            }
        });
    }

    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!isRunning) {
                pomodoroInput.value = btn.getAttribute('data-time');
                setTimerBtn.click();
            } else {
                showToast("Cannot change time while running");
            }
        });
    });

    if (playBtn && timeLeft) {
        const focusRingPath = document.getElementById('focus-ring-path');
        playBtn.addEventListener('click', () => {
            if (!isRunning) {
                isRunning = true;
                playBtn.innerHTML = '<i class="ri-pause-fill"></i>';
                showToast("Focus session started");
                timerInterval = setInterval(() => {
                    time--;
                    timeLeft.textContent = formatTime(time);
                    if (focusRingPath) {
                        const percentage = (time / defaultTime) * 100;
                        focusRingPath.setAttribute('stroke-dasharray', `${percentage}, 100`);
                    }
                    if(time <= 0) {
                        clearInterval(timerInterval);
                        isRunning = false;
                        playBtn.innerHTML = '<i class="ri-play-fill"></i>';
                        time = defaultTime;
                        timeLeft.textContent = formatTime(time);
                        if (focusRingPath) focusRingPath.setAttribute('stroke-dasharray', `100, 100`);
                        showToast("Focus session completed!");
                        sendNotification("Focus Session Complete!", "Great job! Time for a short break.");
                        playAlarm("Focus Session Complete!");
                    }
                }, 1000);
            } else {
                isRunning = false;
                clearInterval(timerInterval);
                playBtn.innerHTML = '<i class="ri-play-fill"></i>';
                showToast("Timer paused");
            }
        });

        if(stopBtn) {
            stopBtn.addEventListener('click', () => {
                if(isRunning) { showToast("Timer stopped"); }
                isRunning = false;
                clearInterval(timerInterval);
                playBtn.innerHTML = '<i class="ri-play-fill"></i>';
                time = defaultTime;
                timeLeft.textContent = formatTime(time);
                const focusRingPath = document.getElementById('focus-ring-path');
                if (focusRingPath) focusRingPath.setAttribute('stroke-dasharray', `100, 100`);
            });
        }

        if(skipBtn) {
            skipBtn.addEventListener('click', () => {
                isRunning = false;
                clearInterval(timerInterval);
                playBtn.innerHTML = '<i class="ri-play-fill"></i>';
                time = STATE.defaultBreakTime * 60; // Use customized break time
                timeLeft.textContent = formatTime(time);
                const focusRingPath = document.getElementById('focus-ring-path');
                if (focusRingPath) focusRingPath.setAttribute('stroke-dasharray', `100, 100`);
                showToast(`Skipped to ${STATE.defaultBreakTime} min Break`);
            });
        }
    }

    const studyForm = document.getElementById('study-form');
    const practiceLogList = document.getElementById('practice-log-list');
    const studyTopicsList = document.getElementById('study-topics-list');

    function renderStudyTopics() {
        if (!studyTopicsList) return;
        studyTopicsList.innerHTML = '';
        STATE.studyTopics.forEach(topic => {
            const option = document.createElement('option');
            option.value = topic;
            studyTopicsList.appendChild(option);
        });
    }

    function renderStudyLogs() {
        if(!practiceLogList) return;
        practiceLogList.innerHTML = '';
        STATE.studyLogs.forEach(log => {
            const div = document.createElement('div');
            div.style.background = 'rgba(255,255,255,0.1)';
            div.style.padding = '0.5rem';
            div.style.borderRadius = '0.5rem';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.innerHTML = `<span>${log.topic}</span><span>${log.duration} mins</span>`;
            practiceLogList.appendChild(div);
        });
    }

    if (studyForm) {
        renderStudyTopics();
        studyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const topic = document.getElementById('study-topic').value.trim();
            const duration = parseInt(document.getElementById('study-duration').value, 10);
            if(duration > 0 && topic) {
                if (!STATE.studyTopics.includes(topic)) {
                    STATE.studyTopics.push(topic);
                    renderStudyTopics();
                }
                STATE.studyLogs.push({ topic, duration, date: new Date().toISOString() });
                STATE.studyMins += duration;
                saveState();
                renderStudyLogs();
                showToast(`Logged ${duration} mins of ${topic}`);
                document.getElementById('study-duration').value = '';
                document.getElementById('study-topic').value = '';
            }
        });
        renderStudyLogs();
    }

    // Deadlines
    const deadlineList = document.getElementById('deadline-list');
    function renderDeadlines() {
        if(!deadlineList) return;
        deadlineList.innerHTML = '';
        STATE.deadlines.forEach((task, index) => {
            const li = document.createElement('li');
            li.className = `task-item ${task.urgent ? 'urgent' : ''} ${task.completed ? 'completed' : ''}`;
            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div style="display: flex; flex-direction: column;">
                        <span class="task-name">${task.name}</span>
                        <span class="task-date" style="font-size: 0.8rem; color: var(--text-secondary);">${task.date}</span>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="glass-btn icon-only small-btn complete-task-btn" data-index="${index}"><i class="ri-check-line"></i></button>
                        <button class="glass-btn icon-only small-btn delete-deadline-btn" data-index="${index}" style="color: #fe4f70;"><i class="ri-delete-bin-line"></i></button>
                    </div>
                </div>
            `;
            deadlineList.appendChild(li);
        });
    }

    if(deadlineList) {
        deadlineList.addEventListener('click', (e) => {
            const btn = e.target.closest('.complete-task-btn');
            if(btn) {
                const index = parseInt(btn.getAttribute('data-index'), 10);
                STATE.deadlines[index].completed = !STATE.deadlines[index].completed;
                saveState();
                renderDeadlines();
                showToast(STATE.deadlines[index].completed ? "Deadline completed!" : "Deadline unmarked");
            }
            const delBtn = e.target.closest('.delete-deadline-btn');
            if(delBtn) {
                const index = parseInt(delBtn.getAttribute('data-index'), 10);
                STATE.deadlines.splice(index, 1);
                saveState();
                renderDeadlines();
                showToast("Deadline removed");
            }
        });
        renderDeadlines();
    }

    const addDeadlineBtn = document.getElementById('add-deadline-btn');
    if (addDeadlineBtn) {
        addDeadlineBtn.addEventListener('click', () => {
            const name = document.getElementById('new-deadline-name').value.trim();
            const date = document.getElementById('new-deadline-date').value.trim();
            if (name && date) {
                STATE.deadlines.push({ name, date, urgent: false, completed: false });
                saveState();
                renderDeadlines();
                document.getElementById('new-deadline-name').value = '';
                document.getElementById('new-deadline-date').value = '';
                showToast("Deadline added!");
            }
        });
    }


    // --- 5. Calendar Interactivity ---
    const calGrid = document.getElementById('cal-grid');
    const calMonthYear = document.getElementById('cal-month-year');
    const calPrevBtn = document.getElementById('cal-prev-btn');
    const calNextBtn = document.getElementById('cal-next-btn');
    const viewBtns = document.querySelectorAll('#calendar .view-toggles .glass-btn');
    
    let currentDate = new Date();
    let isMonthView = true;

    function renderCalendar() {
        if (!calGrid || !calMonthYear) return;
        calGrid.innerHTML = '';
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        const actualToday = new Date();
        const todayDateKey = `${actualToday.getFullYear()}-${String(actualToday.getMonth()+1).padStart(2,'0')}-${String(actualToday.getDate()).padStart(2,'0')}`;

        if (isMonthView) {
            calMonthYear.textContent = `${monthNames[month]} ${year}`;
            
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            daysOfWeek.forEach(day => {
                const header = document.createElement('div');
                header.className = 'cal-day-header';
                header.textContent = day;
                calGrid.appendChild(header);
            });

            for(let i=0; i<firstDay; i++) {
                const empty = document.createElement('div');
                empty.className = 'cal-cell empty';
                calGrid.appendChild(empty);
            }

            for(let i=1; i<=daysInMonth; i++) {
                const cell = document.createElement('div');
                cell.className = 'cal-cell';
                cell.textContent = i;
                
                const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
                
                if (dateKey === todayDateKey) {
                    cell.classList.add('today');
                }
                
                if(STATE.events[dateKey]) {
                    cell.classList.add('has-event');
                    const dot = document.createElement('div');
                    dot.className = 'event-dot';
                    cell.appendChild(dot);
                    
                    const tooltip = document.createElement('div');
                    tooltip.className = 'event-tooltip';
                    tooltip.textContent = typeof STATE.events[dateKey] === 'object' ? STATE.events[dateKey].name : 'Event';
                    cell.appendChild(tooltip);
                }

                cell.addEventListener('click', () => {
                    openEventModal(dateKey, cell, monthNames[month], i);
                });

                calGrid.appendChild(cell);
            }
        } else {
            // Week View Logic
            const currentDayOfWeek = currentDate.getDay(); // 0 (Sun) to 6 (Sat)
            const weekStart = new Date(currentDate);
            weekStart.setDate(currentDate.getDate() - currentDayOfWeek);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            const startMonth = monthNames[weekStart.getMonth()];
            const endMonth = monthNames[weekEnd.getMonth()];
            
            if (weekStart.getMonth() === weekEnd.getMonth()) {
                calMonthYear.textContent = `${startMonth} ${weekStart.getFullYear()} (Week View)`;
            } else {
                calMonthYear.textContent = `${startMonth} - ${endMonth} ${weekStart.getFullYear()}`;
            }

            const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            daysOfWeek.forEach(day => {
                const header = document.createElement('div');
                header.className = 'cal-day-header';
                header.textContent = day;
                calGrid.appendChild(header);
            });

            for(let i=0; i<7; i++) {
                const renderDate = new Date(weekStart);
                renderDate.setDate(weekStart.getDate() + i);
                
                const rYear = renderDate.getFullYear();
                const rMonth = renderDate.getMonth();
                const rDate = renderDate.getDate();
                
                const cell = document.createElement('div');
                cell.className = 'cal-cell';
                cell.style.height = '120px'; // Taller for week view
                cell.textContent = rDate;
                
                const dateKey = `${rYear}-${String(rMonth+1).padStart(2,'0')}-${String(rDate).padStart(2,'0')}`;
                
                if (dateKey === todayDateKey) {
                    cell.classList.add('today');
                }
                
                if(STATE.events[dateKey]) {
                    cell.classList.add('has-event');
                    const eventBlock = document.createElement('div');
                    eventBlock.className = 'week-view-event';
                    eventBlock.textContent = typeof STATE.events[dateKey] === 'object' ? STATE.events[dateKey].name : 'Event';
                    cell.appendChild(eventBlock);
                }

                cell.addEventListener('click', () => {
                    openEventModal(dateKey, cell, monthNames[rMonth], rDate);
                });

                calGrid.appendChild(cell);
            }
        }
    }

    // --- Calendar Event Modal Logic ---
    const eventModal = document.getElementById('event-modal');
    const closeEventModalBtn = document.getElementById('close-event-modal-btn');
    const eventModalTitle = document.getElementById('event-modal-title');
    const existingEventDetails = document.getElementById('existing-event-details');
    const existingEventName = document.getElementById('existing-event-name');
    const deleteEventBtn = document.getElementById('delete-event-btn');
    const addEventForm = document.getElementById('add-event-form');
    const eventNameInput = document.getElementById('event-name-input');
    const saveEventBtn = document.getElementById('save-event-btn');

    let currentSelectedDateKey = null;
    let currentSelectedCell = null;

    function openEventModal(dateKey, cell, monthName, day) {
        currentSelectedDateKey = dateKey;
        currentSelectedCell = cell;
        
        eventModalTitle.innerHTML = `<i class="ri-calendar-event-line"></i> ${monthName} ${day}`;
        
        if (STATE.events[dateKey]) {
            existingEventDetails.style.display = 'block';
            addEventForm.style.display = 'none';
            existingEventName.textContent = typeof STATE.events[dateKey] === 'object' ? STATE.events[dateKey].name : 'Event';
        } else {
            existingEventDetails.style.display = 'none';
            addEventForm.style.display = 'block';
            eventNameInput.value = '';
        }
        
        eventModal.style.display = 'flex';
        eventNameInput.focus();
    }

    if (closeEventModalBtn && eventModal) {
        closeEventModalBtn.addEventListener('click', () => {
            eventModal.style.display = 'none';
        });
        eventModal.addEventListener('click', (e) => {
            if(e.target === eventModal) eventModal.style.display = 'none';
        });
    }

    if (saveEventBtn) {
        saveEventBtn.addEventListener('click', () => {
            const name = eventNameInput.value.trim();
            if (name && currentSelectedDateKey) {
                STATE.events[currentSelectedDateKey] = { name };
                saveState();
                renderCalendar();
                showToast("Event saved!");
                eventModal.style.display = 'none';
            }
        });
    }

    if (deleteEventBtn) {
        deleteEventBtn.addEventListener('click', () => {
            if (currentSelectedDateKey) {
                delete STATE.events[currentSelectedDateKey];
                saveState();
                renderCalendar();
                showToast("Event deleted!");
                eventModal.style.display = 'none';
            }
        });
    }

    if (calPrevBtn && calNextBtn) {
        calPrevBtn.addEventListener('click', () => {
            if (isMonthView) {
                currentDate.setMonth(currentDate.getMonth() - 1);
            } else {
                currentDate.setDate(currentDate.getDate() - 7);
            }
            renderCalendar();
        });
        calNextBtn.addEventListener('click', () => {
            if (isMonthView) {
                currentDate.setMonth(currentDate.getMonth() + 1);
            } else {
                currentDate.setDate(currentDate.getDate() + 7);
            }
            renderCalendar();
        });
    }

    if (viewBtns.length > 0) {
        viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                viewBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                isMonthView = e.target.textContent === 'Month';
                renderCalendar();
            });
        });
    }
    
    renderCalendar();


    // --- 6. Diet Plan Interactivity ---
    const addWaterBtn = document.getElementById('add-water-btn');
    const waterAmountInput = document.getElementById('water-amount-input');
    const waterLevelFill = document.getElementById('water-level-fill');
    const waterText = document.getElementById('water-text');

    // Make updateDietUI globally available so settings can call it
    window.updateDietUI = renderDiet;

    function renderDiet() {
        if(waterLevelFill && waterText) {
            let percentage = Math.min((STATE.waterIntake / STATE.waterGoal) * 100, 100);
            waterLevelFill.style.height = `${percentage}%`;
            waterText.textContent = `${STATE.waterIntake} / ${STATE.waterGoal} ml`;
        }

        const calGoal = STATE.calGoal;
        const proGoal = STATE.proGoal;
        const carbGoal = STATE.carbGoal;
        
        let estCal = 0;
        let estPro = 0;
        let estCarb = 0;
        
        STATE.meals.forEach(meal => {
            estCal += (meal.cals || 0);
            estPro += (meal.pro || 0);
            estCarb += (meal.carbs || 0);
        });

        const calText = document.getElementById('calories-text');
        const calFill = document.getElementById('calories-fill');
        if(calText && calFill) {
            calText.textContent = `Calories (${estCal}/${calGoal})`;
            calFill.style.width = `${Math.min((estCal/calGoal)*100, 100)}%`;
        }

        const proText = document.getElementById('protein-text');
        const proFill = document.getElementById('protein-fill');
        if(proText && proFill) {
            proText.textContent = `Protein (${estPro}g/${proGoal}g)`;
            proFill.style.width = `${Math.min((estPro/proGoal)*100, 100)}%`;
        }

        const carbText = document.getElementById('carbs-text');
        const carbFill = document.getElementById('carbs-fill');
        if(carbText && carbFill) {
            carbText.textContent = `Carbs (${estCarb}g/${carbGoal}g)`;
            carbFill.style.width = `${Math.min((estCarb/carbGoal)*100, 100)}%`;
        }

        renderMeals();
    }

    if (addWaterBtn) {
        addWaterBtn.addEventListener('click', () => {
            let amount = 250;
            if (waterAmountInput) {
                amount = parseInt(waterAmountInput.value, 10) || 0;
            }
            if (amount > 0) {
                STATE.waterIntake += amount;
                saveState();
                renderDiet();
                showToast(`Logged ${amount}ml of water`);
            }
        });
    }

    // Inline Diet Goals Editing
    const editDietGoalsBtn = document.getElementById('edit-diet-goals-btn');
    const saveDietGoalsBtn = document.getElementById('save-diet-goals-btn');
    const dietGoalsDisplay = document.getElementById('diet-goals-display');
    const dietGoalsEdit = document.getElementById('diet-goals-edit');
    
    if (editDietGoalsBtn && saveDietGoalsBtn && dietGoalsDisplay && dietGoalsEdit) {
        editDietGoalsBtn.addEventListener('click', () => {
            dietGoalsDisplay.style.display = 'none';
            dietGoalsEdit.style.display = 'flex';
            
            document.getElementById('inline-cal-goal').value = STATE.calGoal;
            document.getElementById('inline-pro-goal').value = STATE.proGoal;
            document.getElementById('inline-carb-goal').value = STATE.carbGoal;
            document.getElementById('inline-water-goal').value = STATE.waterGoal;
        });

        saveDietGoalsBtn.addEventListener('click', () => {
            STATE.calGoal = parseInt(document.getElementById('inline-cal-goal').value, 10) || 2200;
            STATE.proGoal = parseInt(document.getElementById('inline-pro-goal').value, 10) || 150;
            STATE.carbGoal = parseInt(document.getElementById('inline-carb-goal').value, 10) || 200;
            STATE.waterGoal = parseInt(document.getElementById('inline-water-goal').value, 10) || 2000;
            
            saveState();
            applyPersonalization();
            renderDiet();
            
            dietGoalsEdit.style.display = 'none';
            dietGoalsDisplay.style.display = 'block';
            showToast("Goals updated!");
        });
    }

    const addMealBtn = document.getElementById('add-meal-btn');
    const saveMealBtn = document.getElementById('save-meal-btn');
    const addMealInputs = document.getElementById('add-meal-inputs');
    const newMealInput = document.getElementById('new-meal-input');
    const newMealCals = document.getElementById('new-meal-cals');
    const newMealPro = document.getElementById('new-meal-pro');
    const newMealCarbs = document.getElementById('new-meal-carbs');
    const mealList = document.getElementById('meal-list');
    
    function renderMeals() {
        if(!mealList) return;
        const children = Array.from(mealList.children);
        children.forEach(c => {
            if(!c.id || c.id !== 'add-meal-card') c.remove();
        });
        
        STATE.meals.forEach((meal, idx) => {
            const newMeal = document.createElement('div');
            newMeal.className = 'meal-card';
            newMeal.style.position = 'relative';
            
            let macrosHtml = '';
            if(meal.cals !== undefined) {
                macrosHtml = `<p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 5px;">${meal.cals} kcal | ${meal.pro}g Pro | ${meal.carbs}g Carb</p>`;
            }

            newMeal.innerHTML = `
                <h4>${meal.type}</h4>
                <p>${meal.name}</p>
                ${macrosHtml}
                <button class="glass-btn icon-only small-btn delete-meal-btn" data-idx="${idx}" style="position: absolute; top: 5px; right: 5px; color: #fe4f70; padding: 2px;">
                    <i class="ri-delete-bin-line"></i>
                </button>
            `;
            mealList.insertBefore(newMeal, document.getElementById('add-meal-card'));
        });
    }

    if (addMealBtn && saveMealBtn && newMealInput && mealList && addMealInputs) {
        addMealBtn.addEventListener('click', () => {
            addMealBtn.style.display = 'none';
            addMealInputs.style.display = 'flex';
            newMealInput.focus();
        });
        
        saveMealBtn.addEventListener('click', () => {
            const mealName = newMealInput.value.trim();
            const cals = parseInt(newMealCals.value, 10) || 0;
            const pro = parseInt(newMealPro.value, 10) || 0;
            const carbs = parseInt(newMealCarbs.value, 10) || 0;

            if (mealName) {
                STATE.meals.push({ name: mealName, type: 'Custom Meal', cals, pro, carbs });
                saveState();
                renderDiet();
                newMealInput.value = '';
                newMealCals.value = '';
                newMealPro.value = '';
                newMealCarbs.value = '';
                showToast("Meal added!");
            }
            addMealBtn.style.display = 'block';
            addMealInputs.style.display = 'none';
        });

        mealList.addEventListener('click', (e) => {
            const delBtn = e.target.closest('.delete-meal-btn');
            if(delBtn) {
                const idx = parseInt(delBtn.getAttribute('data-idx'), 10);
                STATE.meals.splice(idx, 1);
                saveState();
                renderDiet();
                showToast("Meal removed");
            }
        });
    }

    // --- 7. Exercise Interactivity ---
    const exListContainer = document.getElementById('exercise-list-container');
    const addExBtn = document.getElementById('add-ex-btn');
    const newExName = document.getElementById('new-ex-name');
    const newExSets = document.getElementById('new-ex-sets');

    function renderExercises() {
        if(!exListContainer) return;
        exListContainer.innerHTML = '';
        STATE.exercises.forEach((ex, idx) => {
            const exItem = document.createElement('div');
            exItem.className = `ex-item ${ex.completed ? 'completed' : ''}`;
            exItem.innerHTML = `
                <span>${ex.name}</span>
                <div class="ex-controls">
                    <span>${ex.sets}</span>
                    <button class="glass-btn icon-only small-btn check-ex-btn" data-idx="${idx}"><i class="ri-check-line"></i></button>
                    <button class="glass-btn icon-only small-btn delete-ex-btn" data-idx="${idx}" style="color: #fe4f70; margin-left:5px;"><i class="ri-delete-bin-line"></i></button>
                </div>
            `;
            exListContainer.appendChild(exItem);
        });
    }

    if(exListContainer) {
        exListContainer.addEventListener('click', (e) => {
            const checkBtn = e.target.closest('.check-ex-btn');
            if(checkBtn) {
                const idx = parseInt(checkBtn.getAttribute('data-idx'), 10);
                STATE.exercises[idx].completed = !STATE.exercises[idx].completed;
                saveState();
                renderExercises();
            }

            const delBtn = e.target.closest('.delete-ex-btn');
            if(delBtn) {
                const idx = parseInt(delBtn.getAttribute('data-idx'), 10);
                STATE.exercises.splice(idx, 1);
                saveState();
                renderExercises();
                showToast("Exercise deleted");
            }
        });
    }

    if (addExBtn && newExName && newExSets && exListContainer) {
        addExBtn.addEventListener('click', () => {
            const name = newExName.value.trim();
            const sets = newExSets.value.trim();
            if (name && sets) {
                STATE.exercises.push({ id: Date.now(), name, sets, completed: false });
                saveState();
                renderExercises();
                newExName.value = '';
                newExSets.value = '';
                showToast("Exercise added!");
            } else {
                showToast("Please fill out exercise name and sets");
            }
        });
    }

    const startWorkoutBtn = document.getElementById('start-workout-btn');
    if (startWorkoutBtn) {
        let workoutActive = false;
        startWorkoutBtn.addEventListener('click', () => {
            workoutActive = !workoutActive;
            if (workoutActive) {
                startWorkoutBtn.textContent = 'Finish Workout';
                startWorkoutBtn.classList.remove('primary');
                startWorkoutBtn.style.background = '#fe4f70';
                startWorkoutBtn.style.color = '#fff';
                showToast("Workout Started! Let's go!");
            } else {
                startWorkoutBtn.textContent = 'Start Workout';
                startWorkoutBtn.classList.add('primary');
                startWorkoutBtn.style.background = '';
                startWorkoutBtn.style.color = '';
                showToast("Workout Finished. Great job!");
                // Automatically log today's activity if not logged
                const logBtn = document.getElementById('log-today-btn');
                if (logBtn) logBtn.click();
            }
        });
    }

    const logTodayBtn = document.getElementById('log-today-btn');
    const streakContainer = document.getElementById('streak-container');
    
    function renderStreak() {
        if(!streakContainer) return;
        const days = streakContainer.querySelectorAll('.s-day');
        days.forEach((dayEl, i) => {
            if(STATE.streak[i]) {
                dayEl.classList.add('active');
            } else {
                dayEl.classList.remove('active');
            }
        });
    }

    if (logTodayBtn && streakContainer) {
        logTodayBtn.addEventListener('click', () => {
            const today = (new Date().getDay() + 6) % 7; // Mon=0, Sun=6
            if(!STATE.streak[today]) {
                STATE.streak[today] = true;
                saveState();
                renderStreak();
                showToast("Activity logged! Streak updated.");
            } else {
                showToast("Already logged for today!");
            }
        });
    }

    // --- 8. Custom To-Do List Interactivity ---
    const todoForm = document.getElementById('custom-todo-form');
    const todoList = document.getElementById('custom-todo-list');

    function renderTodos() {
        if(!todoList) return;
        todoList.innerHTML = '';
        STATE.customTasks.forEach((task, idx) => {
            const taskItem = document.createElement('li');
            taskItem.className = `task-item custom-task ${task.completed ? 'completed' : ''}`;
            taskItem.draggable = true;
            taskItem.setAttribute('data-idx', idx);
            taskItem.style.display = 'flex';
            taskItem.style.flexDirection = 'column';
            taskItem.style.gap = '10px';
            taskItem.style.cursor = 'grab';
            
            // Drag and drop event listeners for tasks
            taskItem.addEventListener('dragstart', (e) => {
                taskItem.classList.add('dragging');
                taskItem.style.opacity = '0.5';
                e.dataTransfer.setData('text/plain', idx);
            });
            taskItem.addEventListener('dragend', () => {
                taskItem.classList.remove('dragging');
                taskItem.style.opacity = '1';
            });
            
            let timerHtml = '';
            if (task.duration > 0 && !task.completed) {
                timerHtml = `
                <div class="task-timer-area" style="display: flex; align-items: center; gap: 15px; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 8px;">
                    <span class="timer-display" data-idx="${idx}" data-time="${task.remainingTime !== undefined ? task.remainingTime : task.duration * 60}" style="font-size: 1.2rem; font-weight: 500; font-family: monospace;">
                        ${formatTime(task.remainingTime !== undefined ? task.remainingTime : task.duration * 60)}
                    </span>
                    <button class="glass-btn icon-only small-btn timer-play-btn" data-idx="${idx}"><i class="ri-play-fill"></i></button>
                </div>`;
            }

            taskItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span class="task-name">${task.message}</span>
                    <div class="task-actions" style="display: flex; gap: 5px;">
                        <button class="glass-btn icon-only small-btn complete-btn" data-idx="${idx}" title="Complete"><i class="ri-check-line"></i></button>
                        <button class="glass-btn icon-only small-btn delete-btn" data-idx="${idx}" title="Delete" style="color: #fe4f70;"><i class="ri-delete-bin-line"></i></button>
                    </div>
                </div>
                ${timerHtml}
            `;
            
            todoList.appendChild(taskItem);
        });
    }

    if (todoList) {
        todoList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getTaskDragAfterElement(todoList, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                if (afterElement == null) {
                    todoList.appendChild(draggable);
                } else {
                    todoList.insertBefore(draggable, afterElement);
                }
            }
        });

        todoList.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedIdx = e.dataTransfer.getData('text/plain');
            if (draggedIdx === '') return;
            
            // Re-order STATE array based on DOM order
            const newOrder = [];
            const items = todoList.querySelectorAll('.custom-task');
            items.forEach(item => {
                const idx = parseInt(item.getAttribute('data-idx'), 10);
                newOrder.push(STATE.customTasks[idx]);
            });
            
            STATE.customTasks = newOrder;
            saveState();
            renderTodos();
            showToast("Tasks reordered");
        });
    }

    function getTaskDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.custom-task:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    if (todoForm && todoList) {
        todoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const msgInput = document.getElementById('todo-msg');
            const timeInput = document.getElementById('todo-time');
            const message = msgInput.value.trim();
            const duration = parseInt(timeInput.value, 10) || 0;
            
            if(message) {
                STATE.customTasks.push({ message, duration, remainingTime: duration * 60, completed: false });
                saveState();
                renderTodos();
                msgInput.value = '';
                timeInput.value = '';
                showToast("Custom task added!");
            }
        });

        const activeTimers = {};

        todoList.addEventListener('click', (e) => {
            const compBtn = e.target.closest('.complete-btn');
            if (compBtn) {
                const idx = parseInt(compBtn.getAttribute('data-idx'), 10);
                STATE.customTasks[idx].completed = !STATE.customTasks[idx].completed;
                if(activeTimers[idx]) {
                    clearInterval(activeTimers[idx]);
                    delete activeTimers[idx];
                }
                saveState();
                renderTodos();
                showToast(STATE.customTasks[idx].completed ? "Task completed!" : "Task reactivated");
            }

            const delBtn = e.target.closest('.delete-btn');
            if (delBtn) {
                const idx = parseInt(delBtn.getAttribute('data-idx'), 10);
                if(activeTimers[idx]) {
                    clearInterval(activeTimers[idx]);
                    delete activeTimers[idx];
                }
                STATE.customTasks.splice(idx, 1);
                saveState();
                renderTodos();
                showToast("Task deleted.");
            }

            const timerBtn = e.target.closest('.timer-play-btn');
            if (timerBtn) {
                const idx = parseInt(timerBtn.getAttribute('data-idx'), 10);
                const display = todoList.querySelector(`.timer-display[data-idx="${idx}"]`);
                
                if (activeTimers[idx]) {
                    // Pause
                    clearInterval(activeTimers[idx]);
                    delete activeTimers[idx];
                    timerBtn.innerHTML = '<i class="ri-play-fill"></i>';
                    saveState();
                } else {
                    // Play
                    timerBtn.innerHTML = '<i class="ri-pause-fill"></i>';
                    activeTimers[idx] = setInterval(() => {
                        if(STATE.customTasks[idx].remainingTime > 0) {
                            STATE.customTasks[idx].remainingTime--;
                            display.textContent = formatTime(STATE.customTasks[idx].remainingTime);
                        } else {
                            clearInterval(activeTimers[idx]);
                            delete activeTimers[idx];
                            timerBtn.innerHTML = '<i class="ri-play-fill"></i>';
                            showToast(`Time's up for task: ${STATE.customTasks[idx].message}`);
                            sendNotification("Task Timer Complete!", `Time's up for task: ${STATE.customTasks[idx].message}`);
                            playAlarm(`Time's up: ${STATE.customTasks[idx].message}`);
                        }
                    }, 1000);
                }
            }
        });
    }

    // --- Initialize Data ---
    applyPersonalization();
    renderDiet();
    renderExercises();
    renderStreak();
    renderTodos();
    updateDashboardRings();


    // --- 9. Premium Interactive Effects (Removed for Minimalist Theme) ---

    // --- 10. Settings Modal ---
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.querySelector('.close-modal-btn');

    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.style.display = 'flex';
        });
        if(closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => {
                settingsModal.style.display = 'none';
            });
        }
        
        const saveSettingsBtn = document.getElementById('save-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                saveState();
                settingsModal.style.display = 'none';
                showToast("Settings saved successfully!");
            });
        }

        const resetDataBtn = document.getElementById('reset-data-btn');
        if (resetDataBtn) {
            resetDataBtn.addEventListener('click', () => {
                if(confirm("Are you sure you want to reset all app data? This cannot be undone.")) {
                    localStorage.removeItem('aura_planner_state');
                    location.reload();
                }
            });
        }

        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.style.display = 'none';
            }
        });
    }

    // --- 11. Editable Profile & Content Editable Auto-save ---
    const profileName = document.getElementById('profile-name');
    const profileStatus = document.getElementById('profile-status');
    
    const saveContent = (el, key) => {
        if(!el) return;
        el.addEventListener('blur', () => {
            Storage.set(key, el.textContent);
            showToast("Saved!");
            if(key === 'user_name') applyPersonalization(); // refresh greeting
        });
        
        const saved = Storage.get(key, null);
        if (saved) el.textContent = saved;
        
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                el.blur();
            }
        });
    };
    
    saveContent(profileName, 'user_name');
    saveContent(profileStatus, 'user_status');

    // --- 12. Generic Editable Texts ---
    const editableHeaders = document.querySelectorAll('.routine-title, .greeting');
    editableHeaders.forEach((header, index) => {
        if(header.id === 'greeting-text') return; // handled by mood tracker
        header.setAttribute('contenteditable', 'true');
        header.style.cursor = 'pointer';
        header.title = 'Click to edit';
        const key = `editable_header_${index}`;
        saveContent(header, key);
    });

    // --- 13. Drag and Drop Layouts (Widgets) ---
    const grids = document.querySelectorAll('.dashboard-grid, .study-grid, .diet-grid, .exercise-grid, .todo-grid');
    
    grids.forEach((grid, gridIndex) => {
        const gridId = grid.parentElement.id || `grid_${gridIndex}`;
        let draggedItem = null;

        const savedOrder = Storage.get(`layout_${gridId}`, null);
        if (savedOrder) {
            try {
                const order = savedOrder;
                const widgets = Array.from(grid.children);
                widgets.forEach((w, i) => { if(!w.id) w.id = `widget_${gridId}_${i}`; });
                
                order.forEach(id => {
                    const widget = document.getElementById(id);
                    if (widget) grid.appendChild(widget);
                });
            } catch (e) {
                console.error("Error restoring layout", e);
            }
        }

        Array.from(grid.children).forEach((widget, index) => {
            if(!widget.id) widget.id = `widget_${gridId}_${index}`;
            
            if (widget.classList.contains('glass-widget')) {
                widget.setAttribute('draggable', true);
                widget.style.cursor = 'grab';
                
                widget.addEventListener('dragstart', (e) => {
                    draggedItem = widget;
                    widget.style.opacity = '0.5';
                    widget.style.cursor = 'grabbing';
                });

                widget.addEventListener('dragend', () => {
                    widget.style.opacity = '1';
                    widget.style.cursor = 'grab';
                    draggedItem = null;
                    
                    const currentOrder = Array.from(grid.children).map(w => w.id);
                    Storage.set(`layout_${gridId}`, currentOrder);
                    showToast("Layout saved!");
                });
            }
        });

        grid.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(grid, e.clientY, e.clientX);
            if (draggedItem) {
                if (afterElement == null) {
                    grid.appendChild(draggedItem);
                } else {
                    grid.insertBefore(draggedItem, afterElement);
                }
            }
        });
    });

    function getDragAfterElement(container, y, x) {
        const draggableElements = [...container.querySelectorAll('.glass-widget[draggable="true"]:not([style*="opacity: 0.5"])')];
        
        let closest = null;
        let closestDistance = Infinity;

        draggableElements.forEach(child => {
            const box = child.getBoundingClientRect();
            const childCenterX = box.left + box.width / 2;
            const childCenterY = box.top + box.height / 2;
            
            const distance = Math.pow(x - childCenterX, 2) + Math.pow(y - childCenterY, 2);
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = child;
            }
        });
        
        if (!closest) return null;
        
        const box = closest.getBoundingClientRect();
        const isLeft = x < box.left + box.width / 2;
        return isLeft ? closest : closest.nextSibling;
    }

    // --- 14. Scratchpad Logic ---
    const scratchpad = document.getElementById('scratchpad-text');
    if (scratchpad) {
        scratchpad.value = STATE.scratchpadText;
        scratchpad.addEventListener('input', (e) => {
            STATE.scratchpadText = e.target.value;
            saveState();
        });
    }

    // --- 15. Data Management (Export / Import) ---
    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const importInput = document.getElementById('import-data-input');

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(STATE));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "aura_planner_backup.json");
            document.body.appendChild(downloadAnchorNode); 
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            showToast("Data exported successfully!");
        });
    }

    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => {
            importInput.click();
        });

        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedState = JSON.parse(e.target.result);
                    for (const key in importedState) {
                        Storage.set(key, importedState[key]);
                    }
                    showToast("Data imported successfully! Reloading...");
                    setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                    showToast("Error importing data. Invalid file.");
                }
            };
            reader.readAsText(file);
        });
    }

    // --- 16. Global Alarms Logic ---
    const addAlarmBtn = document.getElementById('add-alarm-btn');
    const newAlarmTime = document.getElementById('new-alarm-time');
    const newAlarmLabel = document.getElementById('new-alarm-label');
    const alarmsList = document.getElementById('alarms-list');

    function renderAlarms() {
        if (!alarmsList) return;
        alarmsList.innerHTML = '';
        STATE.alarms.forEach((alarm, idx) => {
            const li = document.createElement('li');
            li.className = `task-item ${alarm.active ? '' : 'completed'}`;
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';

            const infoDiv = document.createElement('div');
            infoDiv.textContent = `${alarm.time} - ${alarm.label}`;
            
            const controlsDiv = document.createElement('div');
            controlsDiv.style.display = 'flex';
            controlsDiv.style.gap = '8px';

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'glass-btn icon-only small-btn';
            toggleBtn.innerHTML = alarm.active ? '<i class="ri-alarm-line"></i>' : '<i class="ri-alarm-off-line"></i>';
            toggleBtn.onclick = () => {
                STATE.alarms[idx].active = !STATE.alarms[idx].active;
                saveState();
                renderAlarms();
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'glass-btn icon-only small-btn';
            delBtn.style.color = '#fe4f70';
            delBtn.innerHTML = '<i class="ri-delete-bin-line"></i>';
            delBtn.onclick = () => {
                STATE.alarms.splice(idx, 1);
                saveState();
                renderAlarms();
            };

            controlsDiv.appendChild(toggleBtn);
            controlsDiv.appendChild(delBtn);
            
            li.appendChild(infoDiv);
            li.appendChild(controlsDiv);
            alarmsList.appendChild(li);
        });
    }

    if (addAlarmBtn && newAlarmTime && newAlarmLabel) {
        addAlarmBtn.addEventListener('click', () => {
            const time = newAlarmTime.value;
            const label = newAlarmLabel.value.trim();
            
            if (time && label) {
                STATE.alarms.push({ time, label, active: true });
                saveState();
                renderAlarms();
                newAlarmTime.value = '';
                newAlarmLabel.value = '';
                showToast("Alarm set successfully");
            } else {
                showToast("Please provide both time and label");
            }
        });
    }
    
    renderAlarms();

    // --- Auth & Backend Integration ---
    const authModal = document.getElementById('auth-modal');
    const closeAuthBtn = document.getElementById('close-auth-btn');
    const authEmail = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authToggleBtn = document.getElementById('auth-toggle-btn');
    const authError = document.getElementById('auth-error');
    const authUserInfo = document.getElementById('auth-user-info');
    const authUserEmail = document.getElementById('auth-user-email');
    const authLogoutBtn = document.getElementById('auth-logout-btn');
    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-title');

    let isSignup = false;

    function initFirebase() {
        if (window.firebaseInitialized && window.fbOnAuth) {
            window.fbOnAuth(window.fbAuth, (user) => {
                if (user) {
                    currentUser = user;
                    if(authModal) authModal.style.display = 'none';
                    
                    const profileIcon = document.getElementById('profile-icon');
                    if(profileIcon) profileIcon.style.color = 'var(--accent)';
                    
                    window.fbGetDoc(window.fbDoc(window.fbDb, "users", user.uid)).then(docSnap => {
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            Object.keys(data).forEach(key => {
                                if(STATE.hasOwnProperty(key)) {
                                    STATE[key] = data[key];
                                    localStorage.setItem(key, JSON.stringify(data[key]));
                                }
                            });
                            // Re-render UI
                            updateDashboardRings();
                            renderTrendChart();
                            renderStudyTopics();
                            renderStudyLogs();
                            renderDeadlines();
                            renderCalendar();
                            renderDiet();
                            renderMeals();
                            renderExercises();
                            renderStreak();
                            renderTodos();
                            renderAlarms();
                            generateInsights();
                        }
                    }).catch(err => console.error("Error fetching user data:", err));
                } else {
                    currentUser = null;
                    const profileIcon = document.getElementById('profile-icon');
                    if(profileIcon) profileIcon.style.color = 'inherit';
                }
            });
        }
    }

    if (window.firebaseInitialized !== undefined) {
        initFirebase();
    } else {
        window.addEventListener('firebaseLoaded', initFirebase);
    }

    if(authToggleBtn) {
        authToggleBtn.addEventListener('click', () => {
            isSignup = !isSignup;
            if(isSignup) {
                authTitle.innerHTML = '<i class="ri-user-add-line"></i> Sign Up';
                authSubmitBtn.textContent = 'Sign Up';
                authToggleBtn.textContent = 'Already have an account? Login';
            } else {
                authTitle.innerHTML = '<i class="ri-user-line"></i> Login';
                authSubmitBtn.textContent = 'Login';
                authToggleBtn.textContent = 'Need an account? Sign up';
            }
            authError.style.display = 'none';
        });
    }

    if(authSubmitBtn) {
        authSubmitBtn.addEventListener('click', () => {
            const email = authEmail.value;
            const password = authPassword.value;
            if(!email || !password) return;
            
            authError.style.display = 'none';
            authSubmitBtn.textContent = 'Processing...';
            
            const authPromise = isSignup 
                ? window.fbSignUp(window.fbAuth, email, password)
                : window.fbSignIn(window.fbAuth, email, password);
                
            authPromise.catch(err => {
                authError.textContent = err.message;
                authError.style.display = 'block';
                authSubmitBtn.textContent = isSignup ? 'Sign Up' : 'Login';
            });
        });
    }
    
    if(authLogoutBtn) {
        authLogoutBtn.addEventListener('click', () => {
            window.fbSignOut(window.fbAuth);
        });
    }
    
    const profileIconTrigger = document.getElementById('profile-icon');
    if(profileIconTrigger) {
        profileIconTrigger.addEventListener('click', (e) => {
            if(currentUser && authModal) {
                authModal.style.display = 'flex';
                authForm.style.display = 'none';
                authUserInfo.style.display = 'flex';
                authUserEmail.textContent = currentUser.email;
                if(closeAuthBtn) closeAuthBtn.style.display = 'block';
            } else if (authModal) {
                authModal.style.display = 'flex';
                authForm.style.display = 'flex';
                authUserInfo.style.display = 'none';
                authTitle.innerHTML = '<i class="ri-user-line"></i> Login';
                isSignup = false;
                authToggleBtn.textContent = 'Need an account? Sign up';
                if(closeAuthBtn) closeAuthBtn.style.display = 'block';
            }
        });
        profileIconTrigger.style.cursor = 'pointer';
    }
    if(closeAuthBtn) {
        closeAuthBtn.addEventListener('click', () => authModal.style.display = 'none');
    }

    // --- Progress Insights Engine ---
    function generateInsights() {
        const insightsContent = document.getElementById('insights-content');
        if(!insightsContent) return;
        
        let insights = [];
        
        // Exercise Insight
        const streakDays = STATE.streak.filter(s => s).length;
        if(streakDays === 0) {
            insights.push("🏋️‍♀️ You haven't exercised this week. A quick 10-minute session today can break the ice!");
        } else if (streakDays >= 5) {
            insights.push("🔥 Awesome exercise streak! Make sure to schedule a rest day for recovery.");
        } else {
            insights.push(`💪 You're on a ${streakDays}-day streak! Keep the momentum going.`);
        }
        
        // Diet Insight
        const totalCals = STATE.meals.reduce((sum, m) => sum + (m.cals || 0), 0);
        if(totalCals < STATE.calGoal * 0.5 && new Date().getHours() > 15) {
            insights.push("🍽️ It's past 3 PM and you're under 50% of your calorie goal. Time for a substantial snack or meal.");
        }
        
        const totalPro = STATE.meals.reduce((sum, m) => sum + (m.pro || 0), 0);
        if(totalPro > 0 && totalPro < STATE.proGoal * 0.8 && new Date().getHours() > 18) {
            insights.push("🍗 You're a bit low on protein today. Consider a high-protein dinner or shake.");
        }
        
        // Study Insight
        if(STATE.studyMins < STATE.defaultFocusTime) {
            insights.push("📚 You haven't hit your minimum study focus time yet. Let's do one Pomodoro session!");
        }
        
        if(insights.length === 0) {
            insights.push("🌟 You're doing great! Keep up the balanced routine.");
        }
        
        // Shuffle and slice
        insights = insights.sort(() => 0.5 - Math.random()).slice(0, 2);
        
        insightsContent.innerHTML = insights.map(i => `<div style="margin-bottom: 12px; display: flex; align-items: flex-start; gap: 8px;"><i class="ri-arrow-right-s-line" style="color: var(--accent);"></i> <span>${i}</span></div>`).join('');
    }
    
    // Initial call
    generateInsights();

    // End of DOMContentLoaded
});
