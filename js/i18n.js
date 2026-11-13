// Traduções do app. A chave é o texto em português; cada entrada traz [en, es, fr, de].
// {x} marca um valor que entra no texto (nome da loja, minutos etc.).

export const LANGS = [
  { id: 'pt', flag: '🇧🇷', name: 'Português' },
  { id: 'en', flag: '🇺🇸', name: 'English' },
  { id: 'es', flag: '🇪🇸', name: 'Español' },
  { id: 'fr', flag: '🇫🇷', name: 'Français' },
  { id: 'de', flag: '🇩🇪', name: 'Deutsch' },
];
const IDX = { en: 0, es: 1, fr: 2, de: 3 };
const LANG_KEY = 'sawgrass.lang';

const D = {
  // ---------- barra, topo e botões ----------
  'Mapa': ['Map', 'Mapa', 'Carte', 'Karte'],
  'Buscar': ['Search', 'Buscar', 'Chercher', 'Suchen'],
  'Encontro': ['Meet-up', 'Encuentro', 'Rendez-vous', 'Treffpunkt'],
  'Carro': ['Car', 'Auto', 'Voiture', 'Auto'],
  'Grupo': ['Group', 'Grupo', 'Groupe', 'Gruppe'],
  'Para onde você vai?': ['Where are you going?', '¿A dónde vas?', 'Où allez-vous ?', 'Wohin möchtest du?'],
  'Você está em': ['You are at', 'Estás en', 'Vous êtes à', 'Du bist bei'],
  'Quer ir para': ['Going to', 'Quieres ir a', 'Vous allez à', 'Ziel'],
  'Escolha a loja mais próxima': ['Pick the nearest store', 'Elige la tienda más cercana', 'Choisissez le magasin le plus proche', 'Nächstes Geschäft wählen'],
  'Escolha o destino': ['Pick a destination', 'Elige el destino', 'Choisissez la destination', 'Ziel wählen'],
  'Inverter origem e destino': ['Swap start and destination', 'Invertir origen y destino', 'Inverser départ et destination', 'Start und Ziel tauschen'],
  'Inverter': ['Swap', 'Invertir', 'Inverser', 'Tauschen'],
  'Limpar rota': ['Clear route', 'Borrar ruta', 'Effacer l’itinéraire', 'Route löschen'],
  'Limpar': ['Clear', 'Borrar', 'Effacer', 'Löschen'],
  '✕ Limpar': ['✕ Clear', '✕ Borrar', '✕ Effacer', '✕ Löschen'],
  'Aproximar': ['Zoom in', 'Acercar', 'Zoomer', 'Vergrößern'],
  'Afastar': ['Zoom out', 'Alejar', 'Dézoomer', 'Verkleinern'],
  'Onde estou (GPS)': ['Where am I (GPS)', 'Dónde estoy (GPS)', 'Où suis-je (GPS)', 'Wo bin ich (GPS)'],
  'Desligar localização': ['Turn off location', 'Apagar ubicación', 'Désactiver la localisation', 'Standort ausschalten'],
  'Fechar': ['Close', 'Cerrar', 'Fermer', 'Schließen'],
  'Ferramentas': ['Tools', 'Herramientas', 'Outils', 'Werkzeuge'],
  'Mapa do piso': ['Floor map', 'Mapa del piso', 'Plan de l’étage', 'Etagenplan'],
  'Pisos': ['Floors', 'Pisos', 'Étages', 'Etagen'],
  'Idioma': ['Language', 'Idioma', 'Langue', 'Sprache'],
  '🌐 Abrir no navegador': ['🌐 Open in browser', '🌐 Abrir en el navegador', '🌐 Ouvrir dans le navigateur', '🌐 Im Browser öffnen'],
  '♿ Sem escada rolante': ['♿ No escalators', '♿ Sin escaleras mecánicas', '♿ Sans escalator', '♿ Ohne Rolltreppe'],
  'Rascunho do editor': ['Editor draft', 'Borrador del editor', 'Brouillon de l’éditeur', 'Editor-Entwurf'],
  'Usar como origem': ['Use as start', 'Usar como origen', 'Utiliser comme départ', 'Als Start nutzen'],
  'Cancelar': ['Cancel', 'Cancelar', 'Annuler', 'Abbrechen'],
  'Salvar': ['Save', 'Guardar', 'Enregistrer', 'Speichern'],
  'Remover': ['Remove', 'Quitar', 'Supprimer', 'Entfernen'],
  'Enviar': ['Send', 'Enviar', 'Envoyer', 'Senden'],
  'Entrar': ['Join', 'Entrar', 'Rejoindre', 'Beitreten'],
  'Não foi possível carregar o mapa. Verifique a conexão e tente de novo.': ['Could not load the map. Check your connection and try again.', 'No se pudo cargar el mapa. Revisa la conexión e inténtalo de nuevo.', 'Impossible de charger la carte. Vérifiez la connexion et réessayez.', 'Karte konnte nicht geladen werden. Verbindung prüfen und erneut versuchen.'],

  // ---------- busca ----------
  'Tudo': ['All', 'Todo', 'Tout', 'Alle'],
  'Buscar loja ou serviço': ['Search store or service', 'Buscar tienda o servicio', 'Chercher un magasin ou service', 'Geschäft oder Service suchen'],
  'Perto de qual loja você está?': ['Which store are you near?', '¿Cerca de qué tienda estás?', 'Près de quel magasin êtes-vous ?', 'In der Nähe welches Geschäfts bist du?'],
  'Para onde você quer ir?': ['Where do you want to go?', '¿A dónde quieres ir?', 'Où voulez-vous aller ?', 'Wohin möchtest du?'],
  'Onde vão se encontrar?': ['Where will you meet?', '¿Dónde se van a encontrar?', 'Où vous retrouvez-vous ?', 'Wo trefft ihr euch?'],
  'Toque na loja mais perto de você.': ['Tap the store closest to you.', 'Toca la tienda más cercana a ti.', 'Touchez le magasin le plus proche.', 'Tippe auf das nächste Geschäft.'],
  'Toque numa loja para traçar a rota. Para marcar várias, use a aba Buscar.': ['Tap a store to get the route. To mark several, use the Search tab.', 'Toca una tienda para trazar la ruta. Para marcar varias, usa la pestaña Buscar.', 'Touchez un magasin pour l’itinéraire. Pour en marquer plusieurs, utilisez l’onglet Chercher.', 'Tippe auf ein Geschäft für die Route. Für mehrere nutze den Tab Suchen.'],
  'Toque na loja para marcar várias (✓) ou em “Ir ➜” para traçar a rota.': ['Tap stores to mark several (✓) or “Go ➜” for the route.', 'Toca las tiendas para marcar varias (✓) o “Ir ➜” para la ruta.', 'Touchez les magasins pour en marquer plusieurs (✓) ou « Aller ➜ » pour l’itinéraire.', 'Tippe Geschäfte zum Markieren (✓) oder „Los ➜“ für die Route.'],
  'Toque no lugar do encontro.': ['Tap the meet-up place.', 'Toca el lugar del encuentro.', 'Touchez le lieu du rendez-vous.', 'Tippe auf den Treffpunkt.'],
  'Toque nas lojas para marcar ou desmarcar.': ['Tap stores to mark or unmark.', 'Toca las tiendas para marcar o desmarcar.', 'Touchez les magasins pour les marquer ou non.', 'Tippe Geschäfte zum (De-)Markieren.'],
  'Nada encontrado.': ['Nothing found.', 'No se encontró nada.', 'Aucun résultat.', 'Nichts gefunden.'],
  'Nada com “{q}” em {g}.': ['Nothing with “{q}” in {g}.', 'Nada con “{q}” en {g}.', 'Rien avec « {q} » dans {g}.', 'Nichts mit „{q}“ in {g}.'],
  '{n} lugar': ['{n} place', '{n} lugar', '{n} lieu', '{n} Ort'],
  '{n} lugares': ['{n} places', '{n} lugares', '{n} lieux', '{n} Orte'],
  '{n} selecionada · toque para desmarcar': ['{n} selected · tap to unmark', '{n} seleccionada · toca para desmarcar', '{n} sélectionné · touchez pour retirer', '{n} ausgewählt · tippen zum Entfernen'],
  '{n} selecionadas · toque para desmarcar': ['{n} selected · tap to unmark', '{n} seleccionadas · toca para desmarcar', '{n} sélectionnés · touchez pour retirer', '{n} ausgewählt · tippen zum Entfernen'],
  'Ir ➜': ['Go ➜', 'Ir ➜', 'Aller ➜', 'Los ➜'],
  'Traçar rota até {x}': ['Route to {x}', 'Ruta hasta {x}', 'Itinéraire vers {x}', 'Route zu {x}'],
  'Ver no mapa': ['Show on map', 'Ver en el mapa', 'Voir sur la carte', 'Auf Karte zeigen'],
  'Ver todas': ['Show all', 'Ver todas', 'Tout voir', 'Alle zeigen'],
  'Selecionados': ['Selected', 'Seleccionados', 'Sélection', 'Ausgewählt'],
  'Selecionados ({n})': ['Selected ({n})', 'Seleccionados ({n})', 'Sélection ({n})', 'Ausgewählt ({n})'],
  '★ {n} marcada': ['★ {n} marked', '★ {n} marcada', '★ {n} marqué', '★ {n} markiert'],
  '★ {n} marcadas': ['★ {n} marked', '★ {n} marcadas', '★ {n} marqués', '★ {n} markiert'],

  // ---------- painel da loja e rota ----------
  'Estou aqui': ['I’m here', 'Estoy aquí', 'Je suis ici', 'Ich bin hier'],
  'Ir para cá': ['Go here', 'Ir aquí', 'Y aller', 'Hierhin'],
  '★ Desmarcar': ['★ Unmark', '★ Desmarcar', '★ Retirer', '★ Entfernen'],
  '☆ Marcar': ['☆ Mark', '☆ Marcar', '☆ Marquer', '☆ Markieren'],
  '🤝 Editar encontro': ['🤝 Edit meet-up', '🤝 Editar encuentro', '🤝 Modifier le rendez-vous', '🤝 Treffpunkt ändern'],
  '🤝 Encontro aqui': ['🤝 Meet here', '🤝 Encuentro aquí', '🤝 Rendez-vous ici', '🤝 Hier treffen'],
  'Origem e destino são o mesmo lugar.': ['Start and destination are the same place.', 'Origen y destino son el mismo lugar.', 'Départ et destination sont au même endroit.', 'Start und Ziel sind derselbe Ort.'],
  'Não encontrei rota sem escada rolante entre esses pontos. Desmarque a opção para ver outras rotas.': ['No route without escalators between these points. Turn the option off to see other routes.', 'No hay ruta sin escaleras mecánicas entre estos puntos. Desmarca la opción para ver otras.', 'Aucun itinéraire sans escalator entre ces points. Décochez l’option pour en voir d’autres.', 'Keine Route ohne Rolltreppe zwischen diesen Punkten. Option abwählen für andere Routen.'],
  'Não encontrei caminho entre esses pontos no mapa.': ['No path found between these points on the map.', 'No se encontró camino entre estos puntos en el mapa.', 'Aucun chemin trouvé entre ces points sur la carte.', 'Kein Weg zwischen diesen Punkten gefunden.'],
  'Pisos: {x}': ['Floors: {x}', 'Pisos: {x}', 'Étages : {x}', 'Etagen: {x}'],
  'Tudo no piso {x}': ['All on floor {x}', 'Todo en el piso {x}', 'Tout à l’étage {x}', 'Alles auf Etage {x}'],
  'A pé, sem trocar de piso': ['On foot, same floor', 'A pie, sin cambiar de piso', 'À pied, même étage', 'Zu Fuß, gleiche Etage'],
  'Passo anterior': ['Previous step', 'Paso anterior', 'Étape précédente', 'Vorheriger Schritt'],
  'Próximo ›': ['Next ›', 'Siguiente ›', 'Suivant ›', 'Weiter ›'],
  'siga por {x}': ['walk {x}', 'sigue {x}', 'continuez sur {x}', '{x} gehen'],
  'Ocultar passos': ['Hide steps', 'Ocultar pasos', 'Masquer les étapes', 'Schritte ausblenden'],
  'Ver os {n} passos': ['See all {n} steps', 'Ver los {n} pasos', 'Voir les {n} étapes', 'Alle {n} Schritte'],
  'poucos metros': ['a few meters', 'pocos metros', 'quelques mètres', 'wenige Meter'],
  'menos de 1 min': ['under 1 min', 'menos de 1 min', 'moins d’1 min', 'unter 1 Min.'],
  '{n} min': ['{n} min', '{n} min', '{n} min', '{n} Min.'],
  // passo a passo (graph.js)
  'Saia de {x}': ['Leave {x}', 'Sal de {x}', 'Sortez de {x}', 'Verlasse {x}'],
  'Siga a partir da sua posição': ['Start from your position', 'Sigue desde tu posición', 'Partez de votre position', 'Starte an deiner Position'],
  'Siga em frente': ['Go straight', 'Sigue recto', 'Continuez tout droit', 'Geradeaus'],
  'Vire à direita': ['Turn right', 'Gira a la derecha', 'Tournez à droite', 'Rechts abbiegen'],
  'Vire à esquerda': ['Turn left', 'Gira a la izquierda', 'Tournez à gauche', 'Links abbiegen'],
  'Mantenha-se à direita': ['Keep right', 'Mantente a la derecha', 'Restez à droite', 'Rechts halten'],
  'Mantenha-se à esquerda': ['Keep left', 'Mantente a la izquierda', 'Restez à gauche', 'Links halten'],
  'Faça o retorno': ['Turn around', 'Da la vuelta', 'Faites demi-tour', 'Umdrehen'],
  '{x} em frente a {y}': ['{x} at {y}', '{x} frente a {y}', '{x} devant {y}', '{x} bei {y}'],
  'Você chegou: {x}': ['You have arrived: {x}', 'Llegaste: {x}', 'Vous êtes arrivé : {x}', 'Angekommen: {x}'],
  '{x}, à sua direita': ['{x}, on your right', '{x}, a tu derecha', '{x}, sur votre droite', '{x}, rechts'],
  '{x}, à sua esquerda': ['{x}, on your left', '{x}, a tu izquierda', '{x}, sur votre gauche', '{x}, links'],
  'Pegue o elevador e suba até o piso {x}': ['Take the elevator up to floor {x}', 'Toma el ascensor y sube al piso {x}', 'Prenez l’ascenseur jusqu’à l’étage {x}', 'Mit dem Aufzug hoch zu Etage {x}'],
  'Pegue o elevador e desça até o piso {x}': ['Take the elevator down to floor {x}', 'Toma el ascensor y baja al piso {x}', 'Prenez l’ascenseur jusqu’à l’étage {x}', 'Mit dem Aufzug runter zu Etage {x}'],
  'Suba pela {y} até o piso {x}': ['Go up the {y} to floor {x}', 'Sube por la {y} al piso {x}', 'Montez par l’{y} à l’étage {x}', 'Mit der {y} hoch zu Etage {x}'],
  'Desça pela {y} até o piso {x}': ['Go down the {y} to floor {x}', 'Baja por la {y} al piso {x}', 'Descendez par l’{y} à l’étage {x}', 'Mit der {y} runter zu Etage {x}'],
  'escada rolante': ['escalator', 'escalera mecánica', 'escalator', 'Rolltreppe'],
  'elevador': ['elevator', 'ascensor', 'ascenseur', 'Aufzug'],
  'esteira rolante': ['moving walkway', 'cinta transportadora', 'tapis roulant', 'Laufband'],
  'escada': ['stairs', 'escalera', 'escalier', 'Treppe'],

  // ---------- marcadores ----------
  'Ponto de encontro: {x}': ['Meet-up point: {x}', 'Punto de encuentro: {x}', 'Point de rendez-vous : {x}', 'Treffpunkt: {x}'],
  'Meu carro': ['My car', 'Mi auto', 'Ma voiture', 'Mein Auto'],
  '🚗 Meu carro': ['🚗 My car', '🚗 Mi auto', '🚗 Ma voiture', '🚗 Mein Auto'],
  '🚗 Meu carro ({x})': ['🚗 My car ({x})', '🚗 Mi auto ({x})', '🚗 Ma voiture ({x})', '🚗 Mein Auto ({x})'],
  '📍 Minha posição': ['📍 My location', '📍 Mi ubicación', '📍 Ma position', '📍 Mein Standort'],
  'Amigo': ['Friend', 'Amigo', 'Ami', 'Freund'],
  'Posição no grupo': ['Position in group', 'Posición en el grupo', 'Position dans le groupe', 'Position in der Gruppe'],
  'Posição compartilhada': ['Shared position', 'Posición compartida', 'Position partagée', 'Geteilte Position'],
  'Você está aqui': ['You are here', 'Estás aquí', 'Vous êtes ici', 'Du bist hier'],

  // ---------- encontro ----------
  '🤝 Ponto de encontro': ['🤝 Meet-up point', '🤝 Punto de encuentro', '🤝 Point de rendez-vous', '🤝 Treffpunkt'],
  'Onde': ['Where', 'Dónde', 'Où', 'Wo'],
  'Horário': ['Time', 'Hora', 'Heure', 'Uhrzeit'],
  'Escolher local': ['Choose place', 'Elegir lugar', 'Choisir le lieu', 'Ort wählen'],
  '📤 Avisar o grupo': ['📤 Tell the group', '📤 Avisar al grupo', '📤 Prévenir le groupe', '📤 Gruppe informieren'],
  'em {h}h{m}': ['in {h}h{m}', 'en {h}h{m}', 'dans {h}h{m}', 'in {h} Std. {m}'],
  'em {n} min': ['in {n} min', 'en {n} min', 'dans {n} min', 'in {n} Min.'],
  'agora': ['now', 'ahora', 'maintenant', 'jetzt'],
  'há {n} min': ['{n} min ago', 'hace {n} min', 'il y a {n} min', 'vor {n} Min.'],

  // ---------- carro ----------
  '🚗 Onde parei o carro': ['🚗 Where I parked', '🚗 Dónde dejé el auto', '🚗 Où j’ai garé la voiture', '🚗 Wo ich geparkt habe'],
  '📍 Usar minha posição agora (GPS)': ['📍 Use my position now (GPS)', '📍 Usar mi posición ahora (GPS)', '📍 Utiliser ma position (GPS)', '📍 Meine Position nutzen (GPS)'],
  '⏳ Procurando sua posição…': ['⏳ Finding your position…', '⏳ Buscando tu posición…', '⏳ Recherche de votre position…', '⏳ Position wird gesucht…'],
  '✅ Posição capturada (±{n} m)': ['✅ Position saved (±{n} m)', '✅ Posición capturada (±{n} m)', '✅ Position enregistrée (±{n} m)', '✅ Position erfasst (±{n} m)'],
  'Anotação': ['Note', 'Nota', 'Note', 'Notiz'],
  'Ex.: fileira B, vaga 23, perto do poste azul': ['E.g.: row B, spot 23, near the blue pole', 'Ej.: fila B, plaza 23, junto al poste azul', 'Ex. : rangée B, place 23, près du poteau bleu', 'Z. B.: Reihe B, Platz 23, am blauen Pfosten'],
  'Esquecer': ['Forget', 'Olvidar', 'Oublier', 'Vergessen'],
  '🧭 Levar até o carro': ['🧭 Take me to my car', '🧭 Llévame al auto', '🧭 Aller à ma voiture', '🧭 Zum Auto führen'],
  'Escolha…': ['Choose…', 'Elige…', 'Choisir…', 'Wählen…'],
  'Salvo às {t}': ['Saved at {t}', 'Guardado a las {t}', 'Enregistré à {t}', 'Gespeichert um {t}'],
  ' pelo GPS': [' by GPS', ' por GPS', ' par GPS', ' per GPS'],

  // ---------- GPS ----------
  'Este aparelho não oferece localização.': ['This device has no location service.', 'Este dispositivo no ofrece ubicación.', 'Cet appareil n’offre pas la localisation.', 'Dieses Gerät bietet keinen Standort.'],
  'Procurando sua posição…': ['Finding your position…', 'Buscando tu posición…', 'Recherche de votre position…', 'Position wird gesucht…'],
  'Você não está no Sawgrass Mills. A posição aparece quando você chegar ao shopping.': ['You are not at Sawgrass Mills. Your position will show when you get to the mall.', 'No estás en Sawgrass Mills. La posición aparece cuando llegues al centro comercial.', 'Vous n’êtes pas à Sawgrass Mills. Votre position s’affichera à votre arrivée.', 'Du bist nicht in Sawgrass Mills. Die Position erscheint, sobald du dort bist.'],
  'baixa precisão': ['low accuracy', 'baja precisión', 'faible précision', 'geringe Genauigkeit'],
  '✅ Você chegou: {x}': ['✅ You have arrived: {x}', '✅ Llegaste: {x}', '✅ Vous êtes arrivé : {x}', '✅ Angekommen: {x}'],
  '{a} {x} · {n} m pela rota ({p})': ['{a} {x} · {n} m along the route ({p})', '{a} {x} · {n} m por la ruta ({p})', '{a} {x} · {n} m par l’itinéraire ({p})', '{a} {x} · {n} m auf der Route ({p})'],
  '📍 Perto de {x} ({p})': ['📍 Near {x} ({p})', '📍 Cerca de {x} ({p})', '📍 Près de {x} ({p})', '📍 Bei {x} ({p})'],
  'Você está aqui ({p})': ['You are here ({p})', 'Estás aquí ({p})', 'Vous êtes ici ({p})', 'Du bist hier ({p})'],
  'Aqui dentro o GPS fica bloqueado. Toque em “🌐 Abrir no navegador” para usar a localização.': ['GPS is blocked here. Tap “🌐 Open in browser” to use your location.', 'Aquí el GPS está bloqueado. Toca “🌐 Abrir en el navegador” para usar la ubicación.', 'Le GPS est bloqué ici. Touchez « 🌐 Ouvrir dans le navigateur ».', 'Hier ist GPS gesperrt. Tippe auf „🌐 Im Browser öffnen“.'],
  'Localização bloqueada. iPhone: Ajustes › Privacidade e Segurança › Serviços de Localização › Sites do Safari › Durante o Uso. Depois, no Safari, toque em aA › Ajustes do Site › Localização › Perguntar e recarregue.': ['Location blocked. iPhone: Settings › Privacy & Security › Location Services › Safari Websites › While Using. Then in Safari tap aA › Website Settings › Location › Ask and reload.', 'Ubicación bloqueada. iPhone: Ajustes › Privacidad y seguridad › Localización › Sitios web de Safari › Cuando se use. Luego en Safari toca aA › Ajustes del sitio › Ubicación › Preguntar y recarga.', 'Localisation bloquée. iPhone : Réglages › Confidentialité et sécurité › Service de localisation › Sites web Safari › Lorsque l’app est active. Puis dans Safari : aA › Réglages du site › Localisation › Demander, et rechargez.', 'Standort gesperrt. iPhone: Einstellungen › Datenschutz & Sicherheit › Ortungsdienste › Safari-Websites › Beim Verwenden. Dann in Safari aA › Website-Einstellungen › Standort › Fragen und neu laden.'],
  'O GPS está demorando. Dentro do shopping o sinal é fraco; tente perto de uma entrada.': ['GPS is taking a while. The signal is weak indoors; try near an entrance.', 'El GPS está tardando. Dentro del centro la señal es débil; prueba cerca de una entrada.', 'Le GPS est lent. Le signal est faible à l’intérieur ; essayez près d’une entrée.', 'GPS dauert. Drinnen ist das Signal schwach; versuche es nahe einem Eingang.'],
  'Não foi possível obter sua posição agora.': ['Could not get your position right now.', 'No se pudo obtener tu posición ahora.', 'Impossible d’obtenir votre position.', 'Position konnte nicht ermittelt werden.'],

  // ---------- grupo ----------
  '👥 Grupo': ['👥 Group', '👥 Grupo', '👥 Groupe', '👥 Gruppe'],
  'Crie um grupo para conversar e combinar o encontro com quem está com você. Tudo some quando o grupo é excluído, ou sozinho depois de 24 h.': ['Create a group to chat and plan a meet-up with the people you’re with. Everything disappears when the group is deleted, or after 24 h.', 'Crea un grupo para conversar y quedar con quienes están contigo. Todo se borra al eliminar el grupo, o solo después de 24 h.', 'Créez un groupe pour discuter et fixer un rendez-vous. Tout disparaît quand le groupe est supprimé, ou après 24 h.', 'Erstelle eine Gruppe zum Chatten und Verabreden. Alles verschwindet, wenn die Gruppe gelöscht wird, oder nach 24 Std.'],
  'Seu nome': ['Your name', 'Tu nombre', 'Votre nom', 'Dein Name'],
  'Ex.: Gil': ['E.g.: Sam', 'Ej.: Ana', 'Ex. : Léa', 'Z. B.: Max'],
  'Criar grupo': ['Create group', 'Crear grupo', 'Créer un groupe', 'Gruppe erstellen'],
  'ou entre com um código': ['or join with a code', 'o entra con un código', 'ou rejoignez avec un code', 'oder mit Code beitreten'],
  '📤 Só mandar um link (sem grupo)': ['📤 Just send a link (no group)', '📤 Solo enviar un enlace (sin grupo)', '📤 Envoyer juste un lien (sans groupe)', '📤 Nur Link senden (ohne Gruppe)'],
  'Código': ['Code', 'Código', 'Code', 'Code'],
  '➕ Convidar': ['➕ Invite', '➕ Invitar', '➕ Inviter', '➕ Einladen'],
  'Mensagem para o grupo': ['Message to the group', 'Mensaje para el grupo', 'Message au groupe', 'Nachricht an die Gruppe'],
  '📍 Mostrar minha posição no mapa do grupo (com o GPS ligado)': ['📍 Show my position on the group map (GPS on)', '📍 Mostrar mi posición en el mapa del grupo (con GPS)', '📍 Montrer ma position sur la carte du groupe (GPS activé)', '📍 Meine Position auf der Gruppenkarte zeigen (GPS an)'],
  'Sair do grupo': ['Leave group', 'Salir del grupo', 'Quitter le groupe', 'Gruppe verlassen'],
  'Excluir grupo': ['Delete group', 'Eliminar grupo', 'Supprimer le groupe', 'Gruppe löschen'],
  'Excluir apaga a conversa de todos.': ['Deleting erases the chat for everyone.', 'Eliminar borra la conversación de todos.', 'Supprimer efface la discussion pour tous.', 'Löschen entfernt den Chat für alle.'],
  'Sim, excluir': ['Yes, delete', 'Sí, eliminar', 'Oui, supprimer', 'Ja, löschen'],
  'Você saiu do grupo.': ['You left the group.', 'Saliste del grupo.', 'Vous avez quitté le groupe.', 'Du hast die Gruppe verlassen.'],
  'Escreva seu nome para o grupo saber quem é você.': ['Type your name so the group knows who you are.', 'Escribe tu nombre para que el grupo sepa quién eres.', 'Indiquez votre nom pour que le groupe sache qui vous êtes.', 'Gib deinen Namen ein, damit die Gruppe weiß, wer du bist.'],
  'Grupo de {x}': ['{x}’s group', 'Grupo de {x}', 'Groupe de {x}', 'Gruppe von {x}'],
  '{x} criou o grupo 👋': ['{x} created the group 👋', '{x} creó el grupo 👋', '{x} a créé le groupe 👋', '{x} hat die Gruppe erstellt 👋'],
  '{x} entrou no grupo': ['{x} joined the group', '{x} entró al grupo', '{x} a rejoint le groupe', '{x} ist beigetreten'],
  'Aqui dentro do Claude o grupo não funciona. Toque em “🌐 Abrir no navegador”.': ['Groups don’t work inside Claude. Tap “🌐 Open in browser”.', 'El grupo no funciona dentro de Claude. Toca “🌐 Abrir en el navegador”.', 'Le groupe ne fonctionne pas dans Claude. Touchez « 🌐 Ouvrir dans le navigateur ».', 'Gruppen funktionieren nicht in Claude. Tippe auf „🌐 Im Browser öffnen“.'],
  'Não deu para criar o grupo. Confira a internet e tente de novo.': ['Could not create the group. Check your internet and try again.', 'No se pudo crear el grupo. Revisa internet e inténtalo de nuevo.', 'Impossible de créer le groupe. Vérifiez internet et réessayez.', 'Gruppe konnte nicht erstellt werden. Internet prüfen und erneut versuchen.'],
  'O código tem 11 letras, como SAW-K7Q2-M9XD.': ['The code has 11 characters, like SAW-K7Q2-M9XD.', 'El código tiene 11 caracteres, como SAW-K7Q2-M9XD.', 'Le code a 11 caractères, comme SAW-K7Q2-M9XD.', 'Der Code hat 11 Zeichen, z. B. SAW-K7Q2-M9XD.'],
  'Grupo não encontrado. Ele pode ter sido excluído ou passado de 24 h.': ['Group not found. It may have been deleted or be older than 24 h.', 'Grupo no encontrado. Puede haber sido eliminado o tener más de 24 h.', 'Groupe introuvable. Il a peut-être été supprimé ou a plus de 24 h.', 'Gruppe nicht gefunden. Sie wurde gelöscht oder ist älter als 24 Std.'],
  'O grupo foi excluído.': ['The group was deleted.', 'El grupo fue eliminado.', 'Le groupe a été supprimé.', 'Die Gruppe wurde gelöscht.'],
  'O grupo terminou (excluído ou passou de 24 h).': ['The group ended (deleted or over 24 h).', 'El grupo terminó (eliminado o más de 24 h).', 'Le groupe est terminé (supprimé ou plus de 24 h).', 'Die Gruppe ist beendet (gelöscht oder älter als 24 Std.).'],
  'Escreva seu nome e toque em Entrar.': ['Type your name and tap Join.', 'Escribe tu nombre y toca Entrar.', 'Indiquez votre nom et touchez Rejoindre.', 'Gib deinen Namen ein und tippe auf Beitreten.'],
  'Grupo excluído. A conversa foi apagada.': ['Group deleted. The chat was erased.', 'Grupo eliminado. La conversación se borró.', 'Groupe supprimé. La discussion a été effacée.', 'Gruppe gelöscht. Der Chat wurde entfernt.'],
  'Você': ['You', 'Tú', 'Vous', 'Du'],
  '{n} pessoa: {x}': ['{n} person: {x}', '{n} persona: {x}', '{n} personne : {x}', '{n} Person: {x}'],
  '{n} pessoas: {x}': ['{n} people: {x}', '{n} personas: {x}', '{n} personnes : {x}', '{n} Personen: {x}'],
  'Alguém': ['Someone', 'Alguien', 'Quelqu’un', 'Jemand'],
  '👥 Entre no meu grupo do Sawgrass Mills': ['👥 Join my Sawgrass Mills group', '👥 Únete a mi grupo de Sawgrass Mills', '👥 Rejoins mon groupe Sawgrass Mills', '👥 Tritt meiner Sawgrass-Mills-Gruppe bei'],
  'Código: {x}': ['Code: {x}', 'Código: {x}', 'Code : {x}', 'Code: {x}'],
  '✅ Convite copiado. Cole no WhatsApp.': ['✅ Invite copied. Paste it in WhatsApp.', '✅ Invitación copiada. Pégala en WhatsApp.', '✅ Invitation copiée. Collez-la dans WhatsApp.', '✅ Einladung kopiert. In WhatsApp einfügen.'],
  'Mande este código: {x}': ['Send this code: {x}', 'Envía este código: {x}', 'Envoyez ce code : {x}', 'Sende diesen Code: {x}'],

  // ---------- compartilhar ----------
  'Compartilhar com o grupo': ['Share with the group', 'Compartir con el grupo', 'Partager avec le groupe', 'Mit der Gruppe teilen'],
  '📍 Onde estou agora (GPS)': ['📍 Where I am now (GPS)', '📍 Dónde estoy ahora (GPS)', '📍 Où je suis maintenant (GPS)', '📍 Wo ich gerade bin (GPS)'],
  'Marque lojas na busca ou escolha um ponto de encontro (toque numa loja no mapa › “🤝 Encontro aqui”). Você também pode mandar só o link do mapa.': ['Mark stores in Search or pick a meet-up point (tap a store on the map › “🤝 Meet here”). You can also just send the map link.', 'Marca tiendas en Buscar o elige un punto de encuentro (toca una tienda en el mapa › “🤝 Encuentro aquí”). También puedes enviar solo el enlace.', 'Marquez des magasins ou choisissez un point de rendez-vous (touchez un magasin › « 🤝 Rendez-vous ici »). Vous pouvez aussi envoyer juste le lien.', 'Markiere Geschäfte oder wähle einen Treffpunkt (Geschäft antippen › „🤝 Hier treffen“). Du kannst auch nur den Link senden.'],
  '★ Lojas marcadas ({n}): {x}': ['★ Marked stores ({n}): {x}', '★ Tiendas marcadas ({n}): {x}', '★ Magasins marqués ({n}) : {x}', '★ Markierte Geschäfte ({n}): {x}'],
  '🤝 Encontro: {x}': ['🤝 Meet-up: {x}', '🤝 Encuentro: {x}', '🤝 Rendez-vous : {x}', '🤝 Treffpunkt: {x}'],
  ' às {t}': [' at {t}', ' a las {t}', ' à {t}', ' um {t}'],
  '★ Lojas: {x}': ['★ Stores: {x}', '★ Tiendas: {x}', '★ Magasins : {x}', '★ Geschäfte: {x}'],
  '📍 {n} estava perto de {x} às {t}': ['📍 {n} was near {x} at {t}', '📍 {n} estaba cerca de {x} a las {t}', '📍 {n} était près de {x} à {t}', '📍 {n} war um {t} bei {x}'],
  'Eu': ['Me', 'Yo', 'Moi', 'Ich'],
  'aqui': ['here', 'aquí', 'ici', 'hier'],
  'Abra o mapa: {x}': ['Open the map: {x}', 'Abre el mapa: {x}', 'Ouvrez la carte : {x}', 'Karte öffnen: {x}'],
  'Copiado! Cole no WhatsApp do grupo.': ['Copied! Paste it in the group’s WhatsApp.', '¡Copiado! Pégalo en el WhatsApp del grupo.', 'Copié ! Collez-le dans le WhatsApp du groupe.', 'Kopiert! In die WhatsApp-Gruppe einfügen.'],
  '{x} compartilhou': ['{x} shared', '{x} compartió', '{x} a partagé', '{x} hat geteilt'],
  'Compartilhado com você': ['Shared with you', 'Compartido contigo', 'Partagé avec vous', 'Mit dir geteilt'],
  '🤝 encontro na {x}': ['🤝 meet-up at {x}', '🤝 encuentro en {x}', '🤝 rendez-vous à {x}', '🤝 Treffpunkt {x}'],
  '★ {n} lojas': ['★ {n} stores', '★ {n} tiendas', '★ {n} magasins', '★ {n} Geschäfte'],
  '📍 posição às {t}': ['📍 position at {t}', '📍 posición a las {t}', '📍 position à {t}', '📍 Position um {t}'],
  'Guardar lojas': ['Save stores', 'Guardar tiendas', 'Garder les magasins', 'Geschäfte speichern'],
  'Guardar {n} loja': ['Save {n} store', 'Guardar {n} tienda', 'Garder {n} magasin', '{n} Geschäft speichern'],
  'Guardar {n} lojas': ['Save {n} stores', 'Guardar {n} tiendas', 'Garder {n} magasins', '{n} Geschäfte speichern'],
  '📍 Ver rota até o encontro': ['📍 Route to the meet-up', '📍 Ver ruta al encuentro', '📍 Itinéraire vers le rendez-vous', '📍 Route zum Treffpunkt'],

  // ---------- segmentos ----------
  'Alimentação': ['Food', 'Comida', 'Restauration', 'Essen'],
  'Beleza': ['Beauty', 'Belleza', 'Beauté', 'Beauty'],
  'Calçados': ['Shoes', 'Calzado', 'Chaussures', 'Schuhe'],
  'Casa': ['Home', 'Hogar', 'Maison', 'Wohnen'],
  'Entradas': ['Entrances', 'Entradas', 'Entrées', 'Eingänge'],
  'Esportes': ['Sports', 'Deportes', 'Sports', 'Sport'],
  'Estacionamento': ['Parking', 'Estacionamiento', 'Parking', 'Parkplatz'],
  'Facilidades': ['Facilities', 'Servicios básicos', 'Commodités', 'Einrichtungen'],
  'Infantil': ['Kids', 'Niños', 'Enfants', 'Kinder'],
  'Lazer': ['Leisure', 'Ocio', 'Loisirs', 'Freizeit'],
  'Moda': ['Fashion', 'Moda', 'Mode', 'Mode'],
  'Serviços': ['Services', 'Servicios', 'Services', 'Services'],
  'Tecnologia': ['Tech', 'Tecnología', 'High-tech', 'Technik'],
  'Óticas e joias': ['Eyewear & jewelry', 'Ópticas y joyas', 'Optique et bijoux', 'Optik & Schmuck'],
  // categorias
  'Administração': ['Management', 'Administración', 'Administration', 'Verwaltung'],
  'Artigos esportivos': ['Sporting goods', 'Artículos deportivos', 'Articles de sport', 'Sportartikel'],
  'Atendimento e cartões-presente': ['Guest services & gift cards', 'Atención y tarjetas regalo', 'Accueil et cartes-cadeaux', 'Service & Geschenkkarten'],
  'Banheiro': ['Restroom', 'Baño', 'Toilettes', 'Toilette'],
  'Beleza e perfumaria': ['Beauty & fragrance', 'Belleza y perfumería', 'Beauté et parfumerie', 'Beauty & Parfüm'],
  'Bolsas e malas': ['Bags & luggage', 'Bolsos y maletas', 'Sacs et bagages', 'Taschen & Koffer'],
  'Brinquedos': ['Toys', 'Juguetes', 'Jouets', 'Spielzeug'],
  'Casa e decoração': ['Home & decor', 'Hogar y decoración', 'Maison et déco', 'Wohnen & Deko'],
  'Cinema': ['Movie theater', 'Cine', 'Cinéma', 'Kino'],
  'Doces, cafés e lanches': ['Sweets, coffee & snacks', 'Dulces, cafés y meriendas', 'Douceurs, cafés et snacks', 'Süßes, Kaffee & Snacks'],
  'Eletrônicos': ['Electronics', 'Electrónica', 'Électronique', 'Elektronik'],
  'Eletrônicos, música e foto': ['Electronics, music & photo', 'Electrónica, música y foto', 'Électronique, musique et photo', 'Elektronik, Musik & Foto'],
  'Entrada': ['Entrance', 'Entrada', 'Entrée', 'Eingang'],
  'Entretenimento': ['Entertainment', 'Entretenimiento', 'Divertissement', 'Unterhaltung'],
  'Grifes ao ar livre': ['Open-air designer outlets', 'Marcas de lujo al aire libre', 'Grandes marques en plein air', 'Designer-Outlets im Freien'],
  'Hipermercado': ['Hypermarket', 'Hipermercado', 'Hypermarché', 'Großmarkt'],
  'Jogos e diversão': ['Games & fun', 'Juegos y diversión', 'Jeux et loisirs', 'Spiele & Spaß'],
  'Joias, óculos e acessórios': ['Jewelry, eyewear & accessories', 'Joyas, gafas y accesorios', 'Bijoux, lunettes et accessoires', 'Schmuck, Brillen & Accessoires'],
  'Livraria': ['Bookstore', 'Librería', 'Librairie', 'Buchhandlung'],
  'Livros e presentes': ['Books & gifts', 'Libros y regalos', 'Livres et cadeaux', 'Bücher & Geschenke'],
  'Loja de departamento': ['Department store', 'Tienda departamental', 'Grand magasin', 'Kaufhaus'],
  'Moda feminina': ['Women’s fashion', 'Moda femenina', 'Mode femme', 'Damenmode'],
  'Moda masculina': ['Men’s fashion', 'Moda masculina', 'Mode homme', 'Herrenmode'],
  'Moda masculina e feminina': ['Men’s & women’s fashion', 'Moda masculina y femenina', 'Mode homme et femme', 'Damen- & Herrenmode'],
  'Móveis': ['Furniture', 'Muebles', 'Meubles', 'Möbel'],
  'Música e filmes': ['Music & movies', 'Música y películas', 'Musique et films', 'Musik & Filme'],
  'Parque infantil': ['Kids’ park', 'Parque infantil', 'Parc pour enfants', 'Kinderpark'],
  'Praça de alimentação': ['Food court', 'Patio de comidas', 'Aire de restauration', 'Food-Court'],
  'Restaurante': ['Restaurant', 'Restaurante', 'Restaurant', 'Restaurant'],
  'Restaurantes e lazer ao ar livre': ['Open-air dining & leisure', 'Restaurantes y ocio al aire libre', 'Restaurants et loisirs en plein air', 'Restaurants & Freizeit im Freien'],
  'Roupas e calçados infantis': ['Kids’ clothing & shoes', 'Ropa y calzado infantil', 'Vêtements et chaussures enfants', 'Kinderkleidung & -schuhe'],
  'Surfwear': ['Surfwear', 'Ropa de surf', 'Surfwear', 'Surfmode'],
  'Vestuário': ['Clothing', 'Ropa', 'Vêtements', 'Bekleidung'],
  'The Colonnade Outlets (grifes)': ['The Colonnade Outlets (designer)', 'The Colonnade Outlets (marcas de lujo)', 'The Colonnade Outlets (grandes marques)', 'The Colonnade Outlets (Designer)'],
  // nomes de lugares (não lojas)
  'Administração e segurança': ['Management & security', 'Administración y seguridad', 'Administration et sécurité', 'Verwaltung & Sicherheit'],
  'Atendimento ao cliente': ['Guest services', 'Atención al cliente', 'Service client', 'Kundenservice'],
  'Banheiros': ['Restrooms', 'Baños', 'Toilettes', 'Toiletten'],
  'Entrada da praça de alimentação': ['Food court entrance', 'Entrada del patio de comidas', 'Entrée de l’aire de restauration', 'Eingang Food-Court'],
};

// partes que se repetem dentro de nomes (Entrada 3, loja 459, (leste)…)
const WORDS = {
  'loja': ['store', 'tienda', 'magasin', 'Geschäft'],
  'Entrada': ['Entrance', 'Entrada', 'Entrée', 'Eingang'],
  'sudeste': ['southeast', 'sureste', 'sud-est', 'Südost'],
  'leste': ['east', 'este', 'est', 'Ost'],
  'oeste': ['west', 'oeste', 'ouest', 'West'],
  'noroeste': ['northwest', 'noroeste', 'nord-ouest', 'Nordwest'],
  'norte': ['north', 'norte', 'nord', 'Nord'],
};

let lang = 'pt';
export const getLang = () => lang;
export function setLang(l) {
  lang = LANGS.some((x) => x.id === l) ? l : 'pt';
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* sem armazenamento */ }
  document.documentElement.lang = { pt: 'pt-BR', en: 'en', es: 'es', fr: 'fr', de: 'de' }[lang];
}
// idioma salvo; senão, o do celular; senão, português
export function initLang() {
  let l = null;
  try { l = localStorage.getItem(LANG_KEY); } catch { /* sem armazenamento */ }
  if (!l) l = (navigator.languages || [navigator.language || 'pt']).map((x) => x.slice(0, 2).toLowerCase()).find((x) => LANGS.some((y) => y.id === x)) || 'pt';
  setLang(l);
}

const fill = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (v[k] ?? m)) : s);
/** Traduz um texto (chave em português). Sem tradução, devolve o português. */
export function t(key, vars) {
  const row = D[key];
  return fill(lang !== 'pt' && row ? row[IDX[lang]] : key, vars);
}
/** Traduz nomes e categorias vindos dos dados: "Moda feminina · loja 819", "Estacionamento · Entrada 3"… */
export function td(text) {
  if (!text || lang === 'pt') return text;
  return text.split(' · ').map((part) => {
    if (D[part]) return D[part][IDX[lang]];
    return part.replace(/\b(loja|Entrada|sudeste|noroeste|leste|oeste|norte)\b/g, (w) => WORDS[w][IDX[lang]]);
  }).join(' · ');
}
/** Hora no formato do idioma. */
export const clock = (ms) => new Date(ms).toLocaleTimeString({ pt: 'pt-BR', en: 'en-US', es: 'es', fr: 'fr', de: 'de' }[lang], { hour: '2-digit', minute: '2-digit' });

// textos fixos do index.html: guarda o original e troca pelo idioma
const ORIG = new WeakMap();
export function translateDom(root = document.body) {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n.parentElement?.closest('#map, #markers, script, style, #results, #sheet, #gr-msgs')) continue;
    const raw = ORIG.has(n) ? ORIG.get(n) : n.nodeValue;
    const key = raw.trim();
    if (!key || !D[key]) continue;
    ORIG.set(n, raw);
    n.nodeValue = raw.replace(key, t(key));
  }
  for (const el of root.querySelectorAll('[placeholder], [aria-label], [title]')) {
    for (const a of ['placeholder', 'aria-label', 'title']) {
      if (!el.hasAttribute(a)) continue;
      const k = `data-pt-${a}`;
      if (!el.hasAttribute(k)) el.setAttribute(k, el.getAttribute(a));
      const key = el.getAttribute(k);
      if (D[key]) el.setAttribute(a, t(key));
    }
  }
}
