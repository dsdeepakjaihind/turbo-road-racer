let scene, camera, renderer;
let carWheels = []; 
let playerCar;
let obstacles = [];
let coins = [];
let environment = [];
let roadLines = [];
let gameSpeed = 0.8;
let score = 0;
const gameStorage = {
    getItem(key) {
        if (window.GameSnacks?.storage) {
            return window.GameSnacks.storage.getItem(key);
        }
        return null;
    },
    setItem(key, value) {
        if (window.GameSnacks?.storage) {
            window.GameSnacks.storage.setItem(key, String(value));
        } 
    }
};

let highScore = Number(gameStorage.getItem('turboBestScore')) || 0;
let isGameOver = false;
let isGameStarted = false;
let isGamePaused = false;

let moveLeft = false;
let moveRight = false;
const carSpeedX = 0.2;
const roadLimits = 4.5;

const uiHud = document.getElementById('hud');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const speedEl = document.getElementById('speed');
const finalScoreEl = document.getElementById('final-score');
const mobileControls = document.getElementById('mobile-controls');

const loader = new THREE.GLTFLoader();

// ==========================================
// 🎵 SOUND SYSTEM (बिना MP3 फाइल के आवाज़ें)
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function isGameAudioEnabled() {
    return !window.GameSnacks?.audio ||
           window.GameSnacks.audio.isEnabled();
}
let engineOsc, engineGain;

// 1. कॉइन की आवाज़ (Ting!)
function playCoinSound() {
    if (!isGameAudioEnabled()) return;
    if (!isGameAudioEnabled()) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(2000, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

// 2. टकराने की आवाज़ (Crash/Boom)
function playCrashSound() {
    if (!isGameAudioEnabled()) return;
    if (!isGameAudioEnabled()) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.5);
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

// 3. कार के इंजन की आवाज़ (जैसे-जैसे स्पीड बढ़ेगी, आवाज़ तेज़ होगी)
function startEngineSound() {
    if (!isGameAudioEnabled()) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    if(engineOsc) return;
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50; 
    engineGain.gain.value = 0.08; // वॉल्यूम
    engineOsc.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();
}

function stopEngineSound() {
    if(engineOsc) {
        engineOsc.stop();
        engineOsc.disconnect();
        engineOsc = null;
    }
}
// ==========================================

function init() {
    if (window.GameSnacks?.audio) {
        if (!isGameAudioEnabled()) {
    stopEngineSound();
}
    window.GameSnacks.audio.subscribe((enabled) => {
        if (!enabled) {
            stopEngineSound();
        } else if (isGameStarted && !isGameOver) {
            startEngineSound();
        }
    });
}
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7ec0ee);
    scene.fog = new THREE.FogExp2(0x7ec0ee, 0.015);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 4.5, 11);
    camera.lookAt(0, 0, -5);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffee, 1.2);
    dirLight.position.set(-15, 25, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    createEnvironment();

    loader.load('tesla.glb', function(gltf) {
        playerCar = gltf.scene;
        playerCar.scale.set(1.5, 1.5, 1.5); 
        playerCar.position.set(0, 0.6, 5); 
        playerCar.rotation.y = -Math.PI / 2; 

        playerCar.traverse(function(node) {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                let partName = node.name.toLowerCase();
                if (partName.includes('wheel') || partName.includes('tire') || partName.includes('tyre') || partName.includes('alloy')) {
                    carWheels.push(node);
                }
            }
        });

        scene.add(playerCar);
        setupControls();
        window.addEventListener('resize', onWindowResize, false);
        highScoreEl.innerText = highScore;
        animate(); 
        
    }, undefined, function(error) {
        console.error('कार का मॉडल लोड नहीं हुआ:', error);
    });
}

function createEnvironment() {
    const grassGeo = new THREE.PlaneGeometry(300, 300);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x2e8b22, roughness: 1 });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    scene.add(grass);

    const roadGeo = new THREE.PlaneGeometry(11, 300);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x252525, roughness: 0.9 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    scene.add(road);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 30; i++) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 3), lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.02, -i * 6 + 20);
        scene.add(line);
        roadLines.push(line);
    }
}

// रंग-बिरंगा ट्रैफिक बनाने का कोड
function spawnObstacle() {
    if(!isGameStarted || isGameOver || !playerCar) return;

    const enemy = playerCar.clone();
    enemy.rotation.y = -Math.PI / 2; 
    enemy.position.set((Math.random() - 0.5) * 8, 0.6, -100);

    const colors = [0xff0000, 0x0000ff, 0x111111, 0xffffff, 0xffaa00, 0x228b22];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    enemy.traverse(function(node) {
        if (node.isMesh) {
            let partName = node.name.toLowerCase();
            if (partName.includes('wheel') || partName.includes('tire') || partName.includes('tyre') || partName.includes('alloy')) {
                carWheels.push(node);
            } 
            else if (!partName.includes('glass') && !partName.includes('window') && !partName.includes('light') && !partName.includes('screen')) {
                node.material = node.material.clone();
                node.material.color.setHex(randomColor);
            }
        }
    });

    scene.add(enemy);
    obstacles.push(enemy);
}

function spawnCoin() {
    if(!isGameStarted || isGameOver) return;
    const coin = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.1, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1 })
    );
    coin.position.set((Math.random() - 0.5) * 8, 0.8, -80);
    coin.castShadow = true;
    scene.add(coin);
    coins.push(coin);
}

function setupControls() {
    window.addEventListener('keydown', (e) => {
        if(e.key === 'ArrowLeft' || e.key === 'a') moveLeft = true;
        if(e.key === 'ArrowRight' || e.key === 'd') moveRight = true;
    });
    window.addEventListener('keyup', (e) => {
        if(e.key === 'ArrowLeft' || e.key === 'a') moveLeft = false;
        if(e.key === 'ArrowRight' || e.key === 'd') moveRight = false;
    });

    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); moveLeft = true; });
    btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); moveLeft = false; });
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); moveRight = true; });
    btnRight.addEventListener('touchend', (e) => { e.preventDefault(); moveRight = false; });

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', restartGame);
}

function startGame() {
    startScreen.classList.add('hidden');
    uiHud.classList.remove('hidden');
    if(window.innerWidth <= 768) mobileControls.classList.remove('hidden');
    isGameStarted = true; score = 0; gameSpeed = 0.8;
    scoreEl.innerText = score; speedEl.innerText = Math.floor(gameSpeed * 120);

    startEngineSound(); // इंजन की आवाज़ चालू

    if(window.gameIntervals) window.gameIntervals.forEach(clearInterval);
    window.gameIntervals = [ setInterval(spawnObstacle, 1200), setInterval(spawnCoin, 1800) ];
}

function restartGame() {
    gameOverScreen.classList.add('hidden');
    obstacles.forEach(obs => scene.remove(obs));
    coins.forEach(coin => scene.remove(coin));
    obstacles = []; coins = []; playerCar.position.x = 0;
    isGameOver = false; startGame();
}

function gameOver() {
    isGameOver = true; isGameStarted = false;
    playCrashSound(); // टकराने की आवाज़
    stopEngineSound(); // इंजन बंद
    if (window.GameSnacks?.game) {
    window.GameSnacks.game.gameOver();
}
    
    if(score > highScore) { highScore = score; gameStorage.setItem('turboBestScore', highScore); }
    finalScoreEl.innerText = score;
    uiHud.classList.add('hidden'); mobileControls.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    if(window.gameIntervals) window.gameIntervals.forEach(clearInterval);
}

function animate() {
    requestAnimationFrame(animate);

    if (isGamePaused) return;

   
if (isGameStarted && !isGameOver && !isGamePaused && playerCar) {
    
        if (moveLeft && playerCar.position.x > -roadLimits) {
            playerCar.position.x -= carSpeedX;
        } else if (moveRight && playerCar.position.x < roadLimits) {
            playerCar.position.x += carSpeedX;
        }
        
        carWheels.forEach(wheel => {
            wheel.rotation.x -= gameSpeed * 0.5; 
        });

        // स्पीड के हिसाब से इंजन की आवाज़ बदलना
        if (engineOsc) {
            engineOsc.frequency.value = 40 + (gameSpeed * 50); 
        }

        const playerBox = new THREE.Box3().setFromObject(playerCar);
        playerBox.expandByScalar(-0.2);
        
        roadLines.forEach(line => { line.position.z += gameSpeed; if(line.position.z > 10) line.position.z = -170; });

        for (let i = obstacles.length - 1; i >= 0; i--) {
            let obs = obstacles[i];
            obs.position.z += gameSpeed * 0.65;
            const obsBox = new THREE.Box3().setFromObject(obs);
            obsBox.expandByScalar(-0.2);

            if (playerBox.intersectsBox(obsBox)) gameOver();
            if (obs.position.z > 15) {
                scene.remove(obs); obstacles.splice(i, 1);
                score += 10;
scoreEl.innerText = score;

if (window.GameSnacks?.score) {
    window.GameSnacks.score.update(score);
}
                gameSpeed += 0.005; speedEl.innerText = Math.floor(gameSpeed * 120);
            }
        }

        for (let i = coins.length - 1; i >= 0; i--) {
            let coin = coins[i];
            coin.position.z += gameSpeed; coin.rotation.y += 0.08;
            const coinBox = new THREE.Box3().setFromObject(coin);

            if (playerBox.intersectsBox(coinBox)) {
                scene.remove(coin); coins.splice(i, 1);
                score += 50;
scoreEl.innerText = score;

if (window.GameSnacks?.score) {
    window.GameSnacks.score.update(score);
}

playCoinSound(); // कॉइन की आवाज़
            } else if (coin.position.z > 15) {
                scene.remove(coin); coins.splice(i, 1);
            }
        }
    }
    renderer.render(scene, camera);
    if (!window.frameReadySent && window.GameSnacks?.game) {
    window.GameSnacks.game.firstFrameReady();
    window.frameReadySent = true;
}
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
if (window.GameSnacks?.game) {
    window.GameSnacks.game.ready();
}
if (window.GameSnacks?.game) {
    window.GameSnacks.game.onPause(pauseGame);
    window.GameSnacks.game.onResume(resumeGame);
}
function pauseGame() {
    if (isGamePaused) return;

    isGamePaused = true;

    if (typeof stopSpawners === "function") {
        stopSpawners();
    }

    if (typeof stopEngineSound === "function") {
        stopEngineSound();
    }

    if (typeof pauseScreen !== "undefined") {
        pauseScreen.style.display = "flex";
    }
}

function resumeGame() {
    if (!isGamePaused) return;

    isGamePaused = false;

    if (typeof pauseScreen !== "undefined") {
        pauseScreen.style.display = "none";
    }

    if (isGameStarted && !isGameOver) {
        if (typeof startSpawners === "function") {
            startSpawners();
        }

        if (typeof startEngineSound === "function" &&
            typeof isGameAudioEnabled === "function" &&
            isGameAudioEnabled()) {
            startEngineSound();
        }
    }
}
const pauseScreen = document.createElement("div");

pauseScreen.id = "pause-screen";
pauseScreen.textContent = "PAUSED";

pauseScreen.style.cssText = `
    position: fixed;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.75);
    color: white;
    font-size: 40px;
    font-weight: bold;
    z-index: 9999;
`;

document.body.appendChild(pauseScreen);
init();