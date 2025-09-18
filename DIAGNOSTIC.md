# 🔍 Diagnostic et Solution - Problèmes Vidéo

## Analyse du Problème

Les erreurs "Erreur vidéo: Inconnue" indiquent que les vidéos ne peuvent pas être chargées. Après analyse, voici les causes possibles :

### 1. **Problème de Chemin**
- Electron a des restrictions de sécurité strictes
- Les chemins relatifs `../../assets/` peuvent ne pas fonctionner selon le contexte
- Le protocole `file:///` peut être bloqué par la politique de sécurité

### 2. **Double Buffering**
- Les deux lecteurs vidéo tentent de charger en même temps
- Les erreurs sont reportées même pour le lecteur inactif

## 🛠️ Solutions Implémentées

### 1. **Messages d'Erreur Améliorés**
```javascript
// Maintenant les erreurs sont détaillées :
- Code 1: Chargement interrompu
- Code 2: Erreur réseau
- Code 3: Décodage impossible  
- Code 4: Fichier introuvable ou format non supporté
```

### 2. **Réinitialisation du Compteur**
- Le compteur d'erreurs se réinitialise après chaque succès
- Évite l'arrêt définitif après 3 erreurs cumulées

### 3. **Outils de Diagnostic**
- `test-media.bat` : Vérifie la présence des fichiers
- `diagnostic.bat` : Lance un test complet des chemins vidéo
- `test-video.html` : Page de test manuelle

## 📋 Actions à Effectuer

### 1. Lancer le Diagnostic
```bash
# Double-cliquer sur diagnostic.bat
```
Cela va :
- Vérifier tous les fichiers
- Tester différents chemins
- Afficher quel chemin fonctionne

### 2. Vérifier la Console (F12)
Regarder les messages comme :
```
[VIDEO ERROR] Player 1: Format non supporté ou fichier introuvable
Source: ../../assets/videos/idle.mp4
```

### 3. Si Aucun Chemin ne Fonctionne

**Option A: Désactiver la Sécurité Web (Temporaire)**
Modifier `src/main.js` :
```javascript
webSecurity: false  // Déjà fait dans participantWindow
```

**Option B: Utiliser un Serveur Local**
Je peux implémenter un serveur HTTP local dans Electron pour servir les fichiers.

**Option C: Utiliser le Protocol Custom**
Enregistrer un protocole custom `media://` pour accéder aux fichiers.

## 🎯 Solution Recommandée

Si le diagnostic montre que les chemins ne fonctionnent pas, je vais implémenter un **protocole custom** dans Electron qui permettra d'accéder aux médias via `media://videos/idle.mp4` au lieu de chemins relatifs.

## 🚀 Test Rapide

1. **Vérifier les extensions** :
   - Vidéos : `.mp4` (minuscules)
   - Audio : `.WAV` (MAJUSCULES)

2. **Tester manuellement** :
   - Ouvrir `src/renderer/test-video.html` dans Chrome
   - Si ça marche dans Chrome mais pas dans Electron = problème de sécurité
   - Si ça ne marche pas dans Chrome = problème de chemin

3. **Logs à Chercher** :
   ```
   [SUCCESS] Lecture de idle démarrée
   [READY] Vidéo idle prête à être lue
   Media path for idle (video): ../../assets/videos/idle.mp4
   ```

## 📝 Prochaine Étape

Lance `diagnostic.bat` et dis-moi :
1. Est-ce qu'un des chemins testés fonctionne ?
2. Quel code d'erreur exact tu obtiens ?
3. Les fichiers sont-ils bien détectés ?

Avec ces infos, je pourrai implémenter la solution définitive (probablement le protocole custom).
