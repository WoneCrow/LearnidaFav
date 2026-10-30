/**
 * favorites.js
 * Questions marquées en favori (⭐) par l'utilisateur.
 *
 * Deux choses à retenir :
 *  - Les favoris sont stockés dans IndexedDB (store "favorites"), donc ils
 *    survivent à la fermeture de l'app et fonctionnent hors ligne.
 *  - Une copie est gardée en mémoire (`cache`) : cela permet de savoir
 *    INSTANTANÉMENT (sans await) si une question est en favori, ce dont
 *    l'affichage d'une question a besoin pour dessiner l'étoile pleine ou vide.
 *
 * On identifie une question par son id interne unique (voir questions.js) :
 * c'est le même identifiant que celui utilisé par les stats et les notes.
 */

const Favorites = (() => {
  const cache = new Map(); // questionId -> { questionId, subjectId, sequenceId, savedAt }

  /** À appeler une fois au démarrage, avant d'afficher la moindre question. */
  async function init() {
    cache.clear();
    try {
      const all = await Storage.getAll('favorites');
      for (const fav of all) cache.set(fav.questionId, fav);
    } catch (err) {
      // IndexedDB indisponible : l'app reste utilisable, sans favoris persistants.
      console.warn('[Learnida] Favoris indisponibles :', err && err.message);
    }
  }

  function isFavorite(questionId) {
    return cache.has(questionId);
  }

  /**
   * Ajoute ou retire la question des favoris. Renvoie le nouvel état
   * (true = en favori). Si l'écriture échoue, l'état en mémoire est annulé
   * et l'erreur est relancée pour que l'interface puisse prévenir l'utilisateur.
   */
  async function toggle(question) {
    const id = question.id;
    if (cache.has(id)) {
      const previous = cache.get(id);
      cache.delete(id);
      try {
        await Storage.deleteRecord('favorites', id);
      } catch (err) {
        cache.set(id, previous);
        throw err;
      }
      return false;
    }

    const fav = {
      questionId: id,
      subjectId: question.subjectId,
      sequenceId: question.sequenceId,
      savedAt: Date.now()
    };
    cache.set(id, fav);
    try {
      await Storage.putRecord('favorites', fav);
    } catch (err) {
      cache.delete(id);
      throw err;
    }
    return true;
  }

  /**
   * Questions en favori, dans l'ordre d'origine du contenu.
   * scope : {} (toutes) | { subjectId } | { subjectId, sequenceId }
   * Les favoris dont la question n'existe plus dans le contenu (question
   * supprimée lors d'une mise à jour) sont simplement ignorés.
   */
  function getQuestions(scope = {}) {
    if (!cache.size) return [];
    return Questions.getAllQuestions().filter((q) => {
      if (!cache.has(q.id)) return false;
      if (scope.subjectId && q.subjectId !== scope.subjectId) return false;
      if (scope.sequenceId && q.sequenceId !== scope.sequenceId) return false;
      return true;
    });
  }

  function count(scope = {}) {
    return getQuestions(scope).length;
  }

  /** Nombre de favoris par matière : { [subjectId]: n } (matières à 0 absentes). */
  function countBySubject() {
    const result = {};
    for (const q of getQuestions()) result[q.subjectId] = (result[q.subjectId] || 0) + 1;
    return result;
  }

  /** Nombre de favoris par séquence pour une matière : { [sequenceId]: n }. */
  function countBySequence(subjectId) {
    const result = {};
    for (const q of getQuestions({ subjectId })) result[q.sequenceId] = (result[q.sequenceId] || 0) + 1;
    return result;
  }

  /** Export (sauvegarde JSON). */
  async function getAll() {
    return Storage.getAll('favorites');
  }

  return { init, isFavorite, toggle, getQuestions, count, countBySubject, countBySequence, getAll };
})();

window.Favorites = Favorites;
