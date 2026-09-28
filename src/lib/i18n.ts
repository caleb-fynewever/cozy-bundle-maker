import { useLayoutEffect } from "react";
import { useUserState } from "@/lib/store";

export type Locale = "en" | "es" | "fr";

export const LANGUAGE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
];

type Pair = [english: string, spanish: string, french: string];
const COPY: Pair[] = [
  ["Feed", "Actividad", "Fil"], ["Quests", "Planes", "Quêtes"], ["Squad", "Grupo", "Groupe"], ["Ranks", "Clasificación", "Classement"], ["Map", "Mapa", "Carte"],
  ["Discover", "Descubrir", "Découvrir"], ["My quests", "Mis planes", "Mes quêtes"], ["Create quest", "Crear plan", "Créer une quête"],
  ["Settings", "Ajustes", "Paramètres"], ["Your profile", "Tu perfil", "Votre profil"], ["Main", "Principal", "Principal"],
  ["Sign in", "Iniciar sesión", "Se connecter"], ["Create your account", "Crea tu cuenta", "Créez votre compte"],
  ["Username must be 3–20 characters: letters, numbers, dots, dashes, underscores.", "El usuario debe tener entre 3 y 20 caracteres: letras, números, puntos, guiones o guiones bajos.", "Le nom d’utilisateur doit comporter entre 3 et 20 caractères : lettres, chiffres, points, tirets ou tirets bas."],
  ["Password must be at least 6 characters.", "La contraseña debe tener al menos 6 caracteres.", "Le mot de passe doit comporter au moins 6 caractères."],
  ["That username is taken. Try signing in instead.", "Ese usuario ya existe. Intenta iniciar sesión.", "Ce nom d’utilisateur est pris. Essayez de vous connecter."],
  ["Couldn't create your account. Try again.", "No se pudo crear tu cuenta. Inténtalo de nuevo.", "Impossible de créer votre compte. Réessayez."],
  ["Wrong username or password.", "Usuario o contraseña incorrectos.", "Nom d’utilisateur ou mot de passe incorrect."],
  ["Account created. Welcome to wego!", "Cuenta creada. ¡Te damos la bienvenida a wego!", "Compte créé. Bienvenue sur wego !"],
  ["Pick up where you left off.", "Continúa donde lo dejaste.", "Reprenez là où vous vous étiez arrêté."],
  ["Just a username and a password. That's it.", "Solo necesitas un usuario y una contraseña.", "Un nom d’utilisateur et un mot de passe, c’est tout."],
  ["username", "usuario", "nom d’utilisateur"], ["password", "contraseña", "mot de passe"],
  ["Hide password", "Ocultar contraseña", "Masquer le mot de passe"], ["Show password", "Mostrar contraseña", "Afficher le mot de passe"],
  ["hide", "ocultar", "masquer"], ["show", "mostrar", "afficher"], ["One sec…", "Un momento…", "Un instant…"],
  ["Create account", "Crear cuenta", "Créer un compte"], ["New here? Create an account", "¿Primera vez? Crea una cuenta", "Nouveau ici ? Créez un compte"],
  ["Already have an account? Sign in", "¿Ya tienes una cuenta? Inicia sesión", "Vous avez déjà un compte ? Connectez-vous"],
  ["see you out there.", "nos vemos por ahí.", "à bientôt dehors."], ["Set up your account", "Configura tu cuenta", "Configurez votre compte"],
  ["One time only. This is how you show up to your friends.", "Solo una vez. Así te verán tus amigos.", "Une seule fois. C’est ainsi que vos amis vous verront."],
  ["Your name", "Tu nombre", "Votre nom"], ["Handle", "Usuario", "Identifiant"], ["Bio", "Biografía", "Bio"],
  ["(optional)", "(opcional)", "(facultatif)"], ["Usually down for coffee walks and cheap eats.", "Siempre me apunto a caminar con café y comer barato.", "Toujours partant pour une balade-café et un repas pas cher."],
  ["Save and start", "Guardar y empezar", "Enregistrer et commencer"], ["make it you.", "hazlo tuyo.", "faites-le à votre image."],
  ["from your people", "de tu gente", "de vos proches"], ["you’re on a quest right now", "estás en un plan ahora mismo", "vous êtes en quête en ce moment"],
  ["tap to open", "toca para abrir", "touchez pour ouvrir"], ["quiet in your squads right now", "tus grupos están tranquilos ahora", "vos groupes sont calmes pour le moment"],
  ["pull some people together", "reúne a tu gente", "rassemblez quelques amis"], ["that's everyone for now", "eso es todo por ahora", "c’est tout pour le moment"],
  ["go make a post", "ve a crear una publicación", "allez créer une publication"], ["You", "Tú", "Vous"], ["did", "hizo", "a fait"],
  ["a quest", "un plan", "une quête"], ["posted!", "¡publicado!", "publié !"], ["squad avg", "media del grupo", "moyenne du groupe"],
  ["your take", "tu opinión", "votre avis"], ["their take", "su opinión", "son avis"], ["Heart", "Me gusta", "J’aime"],
  ["Comments", "Comentarios", "Commentaires"], ["Open comments. Latest:", "Abrir comentarios. Último:", "Ouvrir les commentaires. Dernier :"],
  ["Add a comment", "Añadir un comentario", "Ajouter un commentaire"], ["Add a comment…", "Añade un comentario…", "Ajouter un commentaire…"], ["Post", "Publicar", "Publier"],
  ["with your people", "con tu gente", "avec vos proches"], ["Near your area", "Cerca de ti", "Près de chez vous"], ["From East Bank", "Desde East Bank", "Depuis East Bank"],
  [", location settings", ", ajustes de ubicación", ", paramètres de localisation"], ["Location settings", "Ajustes de ubicación", "Paramètres de localisation"],
  ["Distances are from your approximate area.", "Las distancias parten de tu zona aproximada.", "Les distances partent de votre zone approximative."],
  ["Distances start from East Bank.", "Las distancias parten de East Bank.", "Les distances partent d’East Bank."],
  ["Only an approximate area is saved on this device.", "Solo se guarda una zona aproximada en este dispositivo.", "Seule une zone approximative est enregistrée sur cet appareil."],
  ["Finding you…", "Buscando tu zona…", "Recherche de votre zone…"], ["Update location", "Actualizar ubicación", "Mettre à jour la position"],
  ["Use my location", "Usar mi ubicación", "Utiliser ma position"], ["Turn off", "Desactivar", "Désactiver"],
  ["In progress", "En curso", "En cours"], ["Scheduled", "Programados", "Planifiées"], ["Saved for later", "Guardados para después", "Enregistrées pour plus tard"],
  ["Created by you", "Creados por ti", "Créées par vous"], ["Find a quest", "Buscar un plan", "Trouver une quête"], ["Make one", "Crear uno", "En créer une"],
  ["nothing saved yet", "aún no hay nada guardado", "rien d’enregistré pour le moment"],
  ["Save a quest from the deck and it waits here. Plan one and it moves to the top.", "Guarda un plan y aparecerá aquí. Prográmalo y subirá al principio.", "Enregistrez une quête et elle vous attendra ici. Planifiez-la et elle remontera en haut."],
  ["Continue quest", "Continuar plan", "Continuer la quête"], ["View plan", "Ver plan", "Voir le plan"], ["Let’s go", "Vamos", "C’est parti"],
  ["out now", "en camino", "en route"], ["Directions", "Indicaciones", "Itinéraire"], ["Undo", "Deshacer", "Annuler"],
  ["Quest postcards", "Tarjetas de planes", "Cartes de quêtes"], ["Undo last choice", "Deshacer la última elección", "Annuler le dernier choix"],
  ["How Quests work", "Cómo funcionan los planes", "Comment fonctionnent les quêtes"], ["Not now", "Ahora no", "Pas maintenant"], ["Later", "Después", "Plus tard"],
  ["Save", "Guardar", "Enregistrer"], ["Pass", "Pasar", "Passer"], ["Make a quest", "Crear un plan", "Créer une quête"], ["Title", "Título", "Titre"],
  ["Name your quest", "Ponle nombre a tu plan", "Nommez votre quête"], ["Description", "Descripción", "Description"], ["What actually happens?", "¿Qué van a hacer?", "Qu’allez-vous faire ?"],
  ["Punch it up", "Darle vida", "Donner du style"], ["Location", "Ubicación", "Lieu"], ["Search a place or street address", "Busca un lugar o una dirección", "Rechercher un lieu ou une adresse"],
  ["Location search results", "Resultados de ubicación", "Résultats de recherche de lieu"], ["Duration", "Duración", "Durée"], ["Cost per person", "Costo por persona", "Coût par personne"],
  ["Max group size", "Tamaño máximo del grupo", "Taille maximale du groupe"], ["Publish quest", "Publicar plan", "Publier la quête"],
  ["Your squads", "Tus grupos", "Vos groupes"], ["set up your circle of friends", "forma tu círculo de amigos", "créez votre cercle d’amis"], ["New squad", "Nuevo grupo", "Nouveau groupe"],
  ["New squad name", "Nombre del nuevo grupo", "Nom du nouveau groupe"], ["Give this squad a name", "Ponle nombre al grupo", "Donnez un nom au groupe"],
  ["Create squad", "Crear grupo", "Créer le groupe"], ["Your circles", "Tus círculos", "Vos cercles"], ["All squads", "Todos los grupos", "Tous les groupes"],
  ["Your squads and their rosters, all in one place.", "Tus grupos y sus integrantes, en un solo lugar.", "Vos groupes et leurs membres, au même endroit."],
  ["You’re the creator", "Eres quien lo creó", "Vous l’avez créé"], ["You’re a member", "Eres integrante", "Vous êtes membre"], ["Delete", "Eliminar", "Supprimer"], ["Leave", "Salir", "Quitter"],
  ["Squad name", "Nombre del grupo", "Nom du groupe"], ["Save name", "Guardar nombre", "Enregistrer le nom"], ["(you)", "(tú)", "(vous)"], ["Remove", "Quitar", "Retirer"],
  ["Squad leader", "Líder del grupo", "Responsable du groupe"], ["Friend", "Amigo", "Ami"], ["invite pending", "invitación pendiente", "invitation en attente"], ["Revoke", "Revocar", "Révoquer"],
  ["No members yet. Invite someone below.", "Aún no hay integrantes. Invita a alguien abajo.", "Aucun membre pour le moment. Invitez quelqu’un ci-dessous."],
  ["Invite someone", "Invitar a alguien", "Inviter quelqu’un"], ["By handle if they're on wego, or by email if they're not yet.", "Por usuario si ya está en wego, o por correo si todavía no.", "Par identifiant s’il est sur wego, ou par e-mail sinon."],
  ["Send invite", "Enviar invitación", "Envoyer l’invitation"], ["You’re not in any squads yet. Create one or accept an invite to get started.", "Aún no estás en ningún grupo. Crea uno o acepta una invitación.", "Vous n’êtes encore dans aucun groupe. Créez-en un ou acceptez une invitation."],
  ["Find your people", "Encuentra a tu gente", "Trouvez vos proches"], ["Verify your .edu email", "Verifica tu correo .edu", "Vérifiez votre adresse .edu"],
  ["Verification code", "Código de verificación", "Code de vérification"], ["Student email", "Correo estudiantil", "Adresse étudiante"],
  ["Verify code", "Verificar código", "Vérifier le code"], ["Send code", "Enviar código", "Envoyer le code"], ["Send a new code", "Enviar otro código", "Envoyer un nouveau code"],
  ["Use a different email", "Usar otro correo", "Utiliser une autre adresse"], ["Your student email is verified.", "Tu correo estudiantil está verificado.", "Votre adresse étudiante est vérifiée."],
  ["Show me nearby", "Mostrarme cerca", "Me montrer à proximité"], ["Best matches", "Mejores afinidades", "Meilleures affinités"], ["Everyone nearby", "Todos cerca", "Tout le monde à proximité"],
  ["Distance", "Distancia", "Distance"], ["Stop showing me nearby", "Dejar de mostrarme cerca", "Ne plus me montrer à proximité"],
  ["Delete this squad?", "¿Eliminar este grupo?", "Supprimer ce groupe ?"], ["Leave this squad?", "¿Salir de este grupo?", "Quitter ce groupe ?"], ["Cancel", "Cancelar", "Annuler"],
  ["Delete squad", "Eliminar grupo", "Supprimer le groupe"], ["Leave squad", "Salir del grupo", "Quitter le groupe"],
  ["a little friendly competition", "un poco de competencia amistosa", "un peu de compétition amicale"], ["Who to compare with", "Con quién compararte", "Avec qui comparer"],
  ["Squads", "Grupos", "Groupes"], ["Global", "Global", "Global"], ["Leaderboard", "Clasificación", "Classement"], ["Show fewer", "Mostrar menos", "Afficher moins"],
  ["you", "tú", "vous"], ["Demo", "Demo", "Démo"], ["Shared squads", "Grupos compartidos", "Groupes partagés"], ["passed", "superó", "dépassé"], ["moved up", "subiste", "vous avez progressé"],
  ["your field notes", "tus notas de campo", "vos notes de terrain"], ["UMN student", "Estudiante de UMN", "Étudiant à l’UMN"],
  ["XP this week", "XP esta semana", "XP cette semaine"], ["quests finished", "planes completados", "quêtes terminées"], ["quests made", "planes creados", "quêtes créées"], ["weekly streak", "racha semanal", "série hebdomadaire"],
  ["changes as you go", "cambia con tus planes", "évolue au fil de vos sorties"], ["Do a few quests and this fills in.", "Haz algunos planes y esto se irá llenando.", "Faites quelques quêtes et ceci se remplira."],
  ["small steps add up", "los pequeños pasos cuentan", "les petits pas s’additionnent"], ["XP trail", "Historial de XP", "Parcours XP"], ["places you've been", "lugares donde estuviste", "lieux visités"],
  ["Done", "Hechos", "Terminées"], ["No places yet.", "Aún no hay lugares.", "Aucun lieu pour le moment."], ["little milestones", "pequeños logros", "petites étapes"], ["Stamps", "Sellos", "Tampons"],
  ["Next up:", "A continuación:", "Prochaine étape :"], ["Make it yours", "Hazlo tuyo", "Personnalisez-le"],
  ["Choose what your profile says and who can find you. Your exact location is never shown.", "Elige qué dice tu perfil y quién puede encontrarte. Nunca mostramos tu ubicación exacta.", "Choisissez le contenu de votre profil et qui peut vous trouver. Votre position exacte n’est jamais affichée."],
  ["Profile picture", "Foto de perfil", "Photo de profil"], ["Choose image", "Elegir imagen", "Choisir une image"], ["Remove profile picture", "Quitar foto de perfil", "Retirer la photo de profil"],
  ["Your image stays in this browser on this device.", "Tu imagen permanece en este navegador y dispositivo.", "Votre image reste dans ce navigateur sur cet appareil."],
  ["Name", "Nombre", "Nom"], ["Your vibes", "Tus estilos", "Vos ambiances"], ["Privacy", "Privacidad", "Confidentialité"],
  ["Public profile", "Perfil público", "Profil public"], ["Show me to students nearby", "Mostrarme a estudiantes cercanos", "Me montrer aux étudiants à proximité"],
  ["Use my rough location for suggestions", "Usar mi ubicación aproximada para sugerencias", "Utiliser ma zone approximative pour les suggestions"],
  ["Finding your area…", "Buscando tu zona…", "Recherche de votre zone…"], ["Update area", "Actualizar zona", "Mettre à jour la zone"],
  ["Using your approximate area.", "Usando tu zona aproximada.", "Votre zone approximative est utilisée."], ["Put wego on your phone", "Instala wego en tu teléfono", "Installez wego sur votre téléphone"],
  ["The app changes language right away.", "La aplicación cambia de idioma al instante.", "L’application change de langue immédiatement."],
  ["Language", "Idioma", "Langue"], ["App language", "Idioma de la aplicación", "Langue de l’application"], ["Sign out", "Cerrar sesión", "Se déconnecter"],
  ["Demo tools", "Herramientas demo", "Outils de démo"], ["Load demo", "Cargar demo", "Charger la démo"], ["Reset app", "Reiniciar aplicación", "Réinitialiser l’application"],
  ["Start wego over?", "¿Reiniciar wego?", "Recommencer wego ?"], ["Keep everything", "Conservar todo", "Tout conserver"], ["Save settings", "Guardar ajustes", "Enregistrer les paramètres"],
  ["Saving…", "Guardando…", "Enregistrement…"], ["Keep wego on your phone", "Ten wego en tu teléfono", "Gardez wego sur votre téléphone"], ["Got it", "Entendido", "Compris"],
  ["Wrong turn", "Camino equivocado", "Mauvais chemin"], ["this trail goes nowhere", "este camino no lleva a ningún lado", "ce chemin ne mène nulle part"],
  ["That link doesn’t lead anywhere anymore. Plenty of things near you still do.", "Ese enlace ya no lleva a ningún sitio. Aún hay muchos planes cerca de ti.", "Ce lien ne mène plus nulle part. Il reste beaucoup de choses à faire près de chez vous."],
  ["Something went wrong on our end. You can try refreshing or head back home.", "Algo salió mal. Puedes recargar la página o volver al inicio.", "Un problème est survenu. Vous pouvez actualiser la page ou revenir à l’accueil."],
  ["Back to quests", "Volver a los planes", "Retour aux quêtes"], ["Open the map", "Abrir el mapa", "Ouvrir la carte"], ["This page didn't load", "Esta página no cargó", "Cette page ne s’est pas chargée"],
  ["got a little tangled", "algo se enredó", "un petit nœud s’est formé"], ["Try again", "Intentar de nuevo", "Réessayer"], ["Go home", "Ir al inicio", "Retour à l’accueil"],
  ["Skip to content", "Saltar al contenido", "Aller au contenu"], ["Back", "Atrás", "Retour"], ["Plan a quest", "Planear una salida", "Planifier une quête"],
  ["In your squad", "En tu grupo", "Dans votre groupe"], ["Into lately", "Últimamente le gusta", "En ce moment"], ["their vibes", "sus estilos", "ses ambiances"],
  ["Quest trail", "Historial de planes", "Parcours de quêtes"], ["Invite", "Invitar", "Inviter"], ["Invite sent", "Invitación enviada", "Invitation envoyée"],
  ["Already invited", "Ya está invitado", "Déjà invité"], ["Accept", "Aceptar", "Accepter"], ["Decline", "Rechazar", "Refuser"], ["Dismiss", "Descartar", "Fermer"],
  ["Squad invites", "Invitaciones a grupos", "Invitations de groupe"], ["Invites and updates for your squad.", "Invitaciones y novedades de tu grupo.", "Invitations et nouvelles de votre groupe."],
  ["You’re all caught up. Squad invites will show up here.", "Estás al día. Las invitaciones aparecerán aquí.", "Vous êtes à jour. Les invitations apparaîtront ici."],
  ["Build a squad leaderboard", "Crea una clasificación del grupo", "Créez un classement de groupe"],
  ["Your XP trail starts with your first quest.", "Tu historial de XP empieza con tu primer plan.", "Votre parcours XP commence avec votre première quête."],
  ["iPhone:", "iPhone:", "iPhone :"], ["Android:", "Android:", "Android :"],
  ["fresh face on wego.", "cara nueva en wego.", "petit nouveau sur wego."], ["you've been too", "tú también fuiste", "vous y êtes allé aussi"], ["you too", "tú también", "vous aussi"],
  ["Pick which squad to invite them to.", "Elige a qué grupo invitarle.", "Choisissez le groupe auquel l’inviter."],
  ["Make one on the Squad page", "Crea uno en la página de grupos", "Créez-en un sur la page Groupe"],
  ["Choose an image file.", "Elige un archivo de imagen.", "Choisissez un fichier image."],
  ["That image could not be compressed enough. Try a smaller one.", "No se pudo reducir esa imagen. Prueba con una más pequeña.", "Impossible de réduire cette image. Essayez-en une plus petite."],
  ["Your quests, XP, weekly streak, and badges.", "Tus planes, XP, racha semanal e insignias.", "Vos quêtes, XP, série hebdomadaire et badges."],
  ["How XP works", "Cómo funciona la XP", "Comment fonctionne l’XP"],
  ["This browser cannot share your location.", "Este navegador no puede compartir tu ubicación.", "Ce navigateur ne peut pas partager votre position."],
  ["Could not get your location. Check browser permissions and try again.", "No se pudo obtener tu ubicación. Revisa los permisos del navegador.", "Impossible d’obtenir votre position. Vérifiez les autorisations du navigateur."],
  ["Add a name so your squad knows it's you.", "Añade un nombre para que tu grupo sepa que eres tú.", "Ajoutez un nom pour que votre groupe vous reconnaisse."],
  ["Someone nearby already goes by that handle.", "Alguien cerca ya usa ese usuario.", "Quelqu’un utilise déjà cet identifiant."],
  ["Could not load that image.", "No se pudo cargar esa imagen.", "Impossible de charger cette image."],
  ["Could not sign out. Try again.", "No se pudo cerrar sesión. Inténtalo de nuevo.", "Impossible de se déconnecter. Réessayez."],
  ["Could not save your profile.", "No se pudo guardar tu perfil.", "Impossible d’enregistrer votre profil."],
  ["In common", "En común", "En commun"], ["A friend", "Un amigo", "Un ami"], ["Couldn't send that invite.", "No se pudo enviar la invitación.", "Impossible d’envoyer l’invitation."],
  ["In squad", "En el grupo", "Dans le groupe"], ["Sent", "Enviada", "Envoyée"],
  ["you're here", "estás aquí", "vous êtes ici"], ["Your quest journey", "Tu camino de planes", "Votre parcours de quêtes"], ["to go", "restantes", "restants"],
  ["total XP", "XP total", "XP au total"], ["this level", "este nivel", "ce niveau"], ["Top level reached", "Nivel máximo alcanzado", "Niveau maximal atteint"],
  ["All the way up", "Hasta arriba", "Tout en haut"], ["Progress to next level", "Progreso al siguiente nivel", "Progression vers le niveau suivant"],
  ["Wanderer", "Caminante", "Promeneur"], ["Explorer", "Explorador", "Explorateur"], ["Local", "Local", "Habitué"], ["Adventurer", "Aventurero", "Aventurier"], ["wego Legend", "Leyenda de wego", "Légende wego"],
  ["Finish a quest", "Completa un plan", "Terminez une quête"], ["…with someone from your squad", "…con alguien de tu grupo", "…avec quelqu’un de votre groupe"],
  ["Make a quest others can do", "Crea un plan que otros puedan hacer", "Créez une quête pour les autres"], ["Add someone to your squad", "Añade a alguien a tu grupo", "Ajoutez quelqu’un à votre groupe"],
  ["Verify your student email", "Verifica tu correo estudiantil", "Vérifiez votre adresse étudiante"],
  ["First step", "Primer paso", "Premier pas"], ["first step", "primer paso", "premier pas"], ["Finish one quest", "Completa un plan", "Terminez une quête"], ["finish one quest", "completa un plan", "terminez une quête"],
  ["Regular", "Habitual", "Habitué"], ["regular", "habitual", "habitué"], ["Finish five quests", "Completa cinco planes", "Terminez cinq quêtes"],
  ["Quest maker", "Creador de planes", "Créateur de quêtes"], ["quest maker", "creador de planes", "créateur de quêtes"], ["Make a quest", "Crea un plan", "Créez une quête"], ["make a quest", "crea un plan", "créez une quête"],
  ["Full squad", "Grupo completo", "Groupe complet"], ["full squad", "grupo completo", "groupe complet"], ["Have three in your squad", "Ten tres personas en tu grupo", "Ayez trois personnes dans votre groupe"],
  ["Four-week run", "Racha de cuatro semanas", "Série de quatre semaines"], ["4-week run", "racha de 4 semanas", "série de 4 semaines"],
  ["Finish a quest every week for four weeks", "Completa un plan cada semana durante cuatro semanas", "Terminez une quête chaque semaine pendant quatre semaines"],
  ["Chill", "Tranqui", "Détente"], ["Active", "Activo", "Actif"], ["Food", "Comida", "Cuisine"], ["Creative", "Creativo", "Créatif"], ["Social", "Social", "Social"],
  ["Weird", "Raro", "Insolite"], ["Outdoors", "Aire libre", "Plein air"], ["Competitive", "Competitivo", "Compétitif"], ["Late Night", "Noche", "Tard le soir"],
];

const resources = {
  en: Object.fromEntries(COPY.map(([en]) => [en, en])),
  es: Object.fromEntries(COPY.map(([en, es]) => [en, es])),
  fr: Object.fromEntries(COPY.map(([en, , fr]) => [en, fr])),
};

function englishFor(value: string) {
  for (const [en, es, fr] of COPY) if (value === es || value === fr) return en;
  return value;
}

export function translate(value: string, locale: Locale) {
  const english = englishFor(value);
  return locale === "en" ? english : resources[locale][english] ?? value;
}

function translateTemplate(value: string, locale: Locale) {
  const exact = translate(value, locale);
  if (exact !== value || locale === "en") return exact;
  const patterns: [RegExp, (match: RegExpMatchArray) => string][] = [
    [/^Show all (\d+)$/, (m) => locale === "es" ? `Mostrar los ${m[1]}` : `Afficher les ${m[1]}`],
    [/^(\d+) more$/, (m) => locale === "es" ? `${m[1]} más` : `${m[1]} de plus`],
    [/^within (\d+) mi$/, (m) => locale === "es" ? `a ${m[1]} mi` : `dans un rayon de ${m[1]} mi`],
    [/^(\d+(?:\.\d+)?) mi away$/, (m) => locale === "es" ? `a ${m[1]} mi` : `à ${m[1]} mi`],
    [/^(\d+)% vibe match$/, (m) => locale === "es" ? `${m[1]} % de afinidad` : `${m[1]} % d’affinité`],
    [/^You \+ (\d+) person$/, (m) => locale === "es" ? `Tú + ${m[1]} persona` : `Vous + ${m[1]} personne`],
    [/^You \+ (\d+) people$/, (m) => locale === "es" ? `Tú + ${m[1]} personas` : `Vous + ${m[1]} personnes`],
    [/^View (.+)'s profile$/, (m) => locale === "es" ? `Ver el perfil de ${m[1]}` : `Voir le profil de ${m[1]}`],
    [/^Remove (.+) from (.+)$/, (m) => locale === "es" ? `Quitar a ${m[1]} de ${m[2]}` : `Retirer ${m[1]} de ${m[2]}`],
    [/^You joined (.+)\.$/, (m) => locale === "es" ? `Te uniste a ${m[1]}.` : `Vous avez rejoint ${m[1]}.`],
    [/^Join (.+)\?$/, (m) => locale === "es" ? `¿Unirte a ${m[1]}?` : `Rejoindre ${m[1]} ?`],
    [/^(.+) invited you$/, (m) => locale === "es" ? `${m[1]} te invitó` : `${m[1]} vous a invité`],
    [/^Invite sent to (.+)$/, (m) => locale === "es" ? `Invitación enviada a ${m[1]}` : `Invitation envoyée à ${m[1]}`],
    [/^Open the quest (.+)$/, (m) => locale === "es" ? `Abrir el plan ${m[1]}` : `Ouvrir la quête ${m[1]}`],
    [/^level (\d+)$/i, (m) => locale === "es" ? `nivel ${m[1]}` : `niveau ${m[1]}`],
    [/^([\d,.]+) XP to (.+)$/, (m) => locale === "es" ? `${m[1]} XP para ${translate(m[2]!, locale)}` : `${m[1]} XP avant ${translate(m[2]!, locale)}`],
    [/^(\d+) more (quest|quests|week|weeks)(?: in a row)?$/, (m) => {
      const n = m[1]; const week = m[2]!.startsWith("week"); const row = m[0].endsWith("in a row");
      return locale === "es" ? `${n} ${week ? "semanas" : "planes"} más${row ? " seguidas" : ""}` : `encore ${n} ${week ? "semaines" : "quêtes"}${row ? " d’affilée" : ""}`;
    }],
    [/^(\d+) more in your squad$/, (m) => locale === "es" ? `${m[1]} más en tu grupo` : `encore ${m[1]} dans votre groupe`],
  ];
  for (const [pattern, render] of patterns) {
    const match = value.match(pattern);
    if (match) return render(match);
  }
  return value;
}

function localizeElement(root: ParentNode, locale: Locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const node of textNodes) {
    if (node.parentElement?.closest("[data-no-translate], script, style")) continue;
    const raw = node.data;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const next = translateTemplate(trimmed, locale);
    if (next !== trimmed) node.data = raw.replace(trimmed, next);
  }
  const elements = root instanceof Element ? [root, ...root.querySelectorAll<HTMLElement>("*")] : [...root.querySelectorAll<HTMLElement>("*")];
  for (const element of elements) {
    if (element.closest("[data-no-translate]")) continue;
    for (const attribute of ["aria-label", "placeholder", "title"] as const) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = translateTemplate(value, locale);
      if (next !== value) element.setAttribute(attribute, next);
    }
  }
}

export function AppLanguage() {
  const locale = useUserState().language;
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    localizeElement(document.body, locale);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData" && record.target.parentNode) localizeElement(record.target.parentNode, locale);
        for (const node of record.addedNodes) if (node instanceof Element) localizeElement(node, locale);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);
  return null;
}