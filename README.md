# Virtual Agent Experiment - Application Desktop

Application Electron pour l'expérience sur l'Illusion de Compréhension avec agent virtuel pédagogique.

## 🚀 Installation

### Prérequis
- Node.js v18+ et npm
- Windows 11

### Installation des dépendances
```bash
cd C:\Users\antoi\Documents\virtual-agent
npm install
```

## 📁 Structure des médias

⚠️ **IMPORTANT**: Vous devez ajouter vos fichiers médias dans les dossiers suivants :

### Vidéos (Condition Humaine)
Placer dans `assets/videos/` :
- `idle.mp4` - Vidéo en boucle de l'agent au repos
- `welcome.mp4` - Agent qui salue les élèves
- `closing.mp4` - Agent qui dit au revoir
- `q1.mp4` à `q6.mp4` - Réponses aux 6 questions

### Audio (Condition Abstraite)
Placer dans `assets/audio/` :
- `idle.wav` - Son d'ambiance en boucle
- `welcome.wav` - Message de bienvenue
- `closing.wav` - Message de conclusion
- `q1.wav` à `q6.wav` - Réponses audio aux 6 questions

## 🎮 Utilisation

### Lancement de l'application

#### Mode Production
```bash
npm start
```

#### Mode Développement (avec DevTools)
```bash
npm run dev
```

### Interface Opérateur

L'interface opérateur s'affiche sur votre écran principal et permet de :

1. **Choisir la condition** : Humain Réaliste ou Abstrait
2. **Contrôler les états** : Welcome, Idle, Closing
3. **Déclencher les questions** : Q1 à Q6
4. **Régler les paramètres** :
   - Vitesse de fondu (100ms - 2000ms)
   - Volume (0-100%)
5. **Précharger les médias** pour éviter les latences
6. **Arrêt d'urgence** avec le bouton STOP

### Vue Participant

La vue participant s'affiche automatiquement sur le second écran (ou en plein écran sur l'écran principal) :

- **Condition Humaine** : Affiche les vidéos avec transitions fluides
- **Condition Abstraite** : Animation réactive au son avec visualisation des fréquences

## 🔧 Caractéristiques Techniques

### Optimisations Implémentées

- **Double Buffering Vidéo** : Transitions sans coupure entre les vidéos
- **Préchargement Intelligent** : Les médias critiques (idle, welcome, closing) sont préchargés au démarrage
- **Gestion Mémoire** : Libération automatique des ressources non utilisées
- **Retour Automatique à l'Idle** : Après chaque réponse, retour automatique à l'état d'attente
- **Boucle Parfaite** : L'état idle boucle sans interruption

### Fonctionnalités Avancées

- **Transitions Paramétrables** : Ajustez la vitesse du fondu en temps réel
- **Journal d'Activité** : Enregistrement de toutes les actions pour analyse
- **Export des Logs** : Exportez l'historique complet de la session
- **Gestion d'Erreurs** : Récupération automatique en cas de problème
- **Multi-écran** : Détection et utilisation automatique du second écran

## 📦 Build de Production

Pour créer un exécutable Windows :

```bash
npm run build
```

L'installateur sera créé dans le dossier `dist/`.

## ⚙️ Configuration Avancée

### Modifier les paramètres par défaut

Éditer `src/main.js` :

```javascript
const CONFIG = {
  DEV_MODE: false,
  OPERATOR_WIDTH: 1200,
  OPERATOR_HEIGHT: 800,
  VIDEO_PRELOAD_COUNT: 3,
  // ...
};
```

### Personnaliser l'animation abstraite

Modifier la fonction `startAudioVisualization()` dans `src/renderer/participant.js` pour changer le style de visualisation.

## 🐛 Dépannage

### Les vidéos ne se lancent pas
- Vérifier que tous les fichiers sont présents dans `assets/videos/`
- S'assurer que les vidéos sont au format MP4 (H.264)

### Pas de son dans la condition abstraite
- Vérifier les fichiers dans `assets/audio/`
- Format requis : WAV

### Latence lors des transitions
- Utiliser le bouton "Précharger Médias Critiques"
- Réduire la résolution des vidéos si nécessaire
- Augmenter `VIDEO_PRELOAD_COUNT` dans la configuration

### L'application ne démarre pas sur le second écran
- Vérifier que le second écran est bien détecté par Windows
- Lancer l'application APRÈS avoir connecté le projecteur

## 📊 Export des Données

Les logs de session peuvent être exportés via l'interface opérateur pour analyse ultérieure. Le format est :
```
[HH:MM:SS] [TYPE] Message
```

## 🎯 Checklist Avant Expérience

- [ ] Tous les médias sont présents dans les bons dossiers
- [ ] Test des deux conditions
- [ ] Projecteur/second écran connecté et configuré
- [ ] Volume audio réglé
- [ ] Préchargement des médias effectué
- [ ] Mode production activé (pas de DevTools visibles)

## 📝 Notes Importantes

- L'agent retourne automatiquement à l'état `idle` après chaque réponse
- Le fondu enchaîné est désactivable en mettant la vitesse à 100ms
- Les transitions utilisent un système de double buffering pour éviter les clignotements
- L'application gère automatiquement les politiques d'autoplay des navigateurs

## 👨‍💻 Développé par

Antoine OGER - ENSAM 2024

## 📄 Licence

MIT
