const forceBrowserDefault = function(e){
  e.stopImmediatePropagation();
  return true;
};
function CancelReadOnly(){
    var EKUserAnswer = document.getElementsByTagName('textarea')
	var EKfinalAnswer = document.getElementsByClassName("nan-qa-correct")
	try{
	for (let i=0;i<EKUserAnswer.length;i++){
			EKUserAnswer[i].readOnly = false;
			EKUserAnswer[i].value = EKfinalAnswer[i].innerHTML
			EKUserAnswer[i].dispatchEvent(new Event('change'))
		}
	}catch{void(0);}
    }
	
var alcBodyARRAY = document.getElementsByTagName("html")
var alcbody = alcBodyARRAY[0]

var ELKLObserve = new MutationObserver(CancelReadOnly)
const config = {childList: true,
				subtree: true,
				characterData: true,
				subtree: true
				}



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
	document.addEventListener('click', CancelReadOnly, false);
	document.addEventListener('fullscreenchange',function(){
		if(document.fullscreenElement != null){document.exitFullscreen();}else{;};},true)
	CancelReadOnly;
	ELKLObserve.observe(alcbody,config);
	;
	
var NOTPOPUPALC = document.getElementsByTagName("a"); 
	for (i=0;i<NOTPOPUPALC.length;i++) { 
        if (NOTPOPUPALC[i].target=="_blank" /* aggressive mode goes here */) { 
            NOTPOPUPALC[i].target="_top" /* _self vs _top */
        } 
	}

