
const forceBrowserDefault = function(e){
	e.stopImmediatePropagation();
	return true;
};
const Click = new Event("click",{bubbles: true});
document.addEventListener('beforecopy', forceBrowserDefault, true);
document.addEventListener('beforecut', forceBrowserDefault, true);
document.addEventListener('contextmenu', forceBrowserDefault, true);
document.addEventListener('copy', forceBrowserDefault, true);
document.addEventListener('dragstart', forceBrowserDefault, true);
document.addEventListener('mousedown', forceBrowserDefault, true);
document.addEventListener('mouseup', forceBrowserDefault, true);
document.addEventListener('cut', forceBrowserDefault, true);
document.addEventListener('paste', forceBrowserDefault, true);
document.addEventListener('selectstart', forceBrowserDefault, true);
//document.addEventListener('click', CancelReadOnly, false);
document.addEventListener('fullscreenchange',function(){if(document.fullscreenElement != null){document.exitFullscreen();}else{;};},true);
//console.log("EvScreenOK")
//ELKLObserve.observe(document.getElementsByTagName("html")[0],{childList: true,subtree: true,characterData: true,subtree: true});
