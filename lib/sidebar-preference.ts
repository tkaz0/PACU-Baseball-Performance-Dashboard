/** Cosmetic, per-browser sidebar width. Never influences access. */
export const SIDEBAR_STORAGE_KEY = "pacu-sidebar";
export const SIDEBAR_BOOTSTRAP_SCRIPT = `(function(){try{if(localStorage.getItem("${SIDEBAR_STORAGE_KEY}")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}})()`;
