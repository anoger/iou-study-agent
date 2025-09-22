// Script de test pour la condition abstraite
// À copier dans la console du navigateur (F12) si besoin

console.log('=== TEST CONDITION ABSTRAITE ===');

// Vérifier l'état du canvas
const canvas = document.getElementById('audioCanvas');
console.log('Canvas présent:', !!canvas);
console.log('Canvas position:', window.getComputedStyle(canvas).position);
console.log('Canvas z-index:', window.getComputedStyle(canvas).zIndex);

// Vérifier l'animation idle
const abstractIdle = document.getElementById('abstractIdle');
console.log('Animation idle présente:', !!abstractIdle);
console.log('Animation idle z-index:', window.getComputedStyle(abstractIdle).zIndex);
console.log('Animation idle visible:', !abstractIdle.classList.contains('audio-playing'));

// Vérifier l'audio player
const audioPlayer = document.getElementById('audioPlayer');
console.log('Audio player présent:', !!audioPlayer);
console.log('Audio source:', audioPlayer.src || 'Aucune');
console.log('Audio en pause:', audioPlayer.paused);

// Vérifier la condition actuelle
if (typeof participantView !== 'undefined') {
    console.log('Condition actuelle:', participantView.condition);
    console.log('Média actuel:', participantView.currentMedia);
    console.log('Idle en boucle:', participantView.isIdleLooping);
}

console.log('=== FIN DU TEST ===');
