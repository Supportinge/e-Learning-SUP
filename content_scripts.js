const forceBrowserDefault = function(e){
  e.stopImmediatePropagation();
  return true;
};
function CancelReadOnly(){
    //要素を取得
    var EKUserAnswer = document.getElementsByTagName('textarea')
	var EKfinalAnswer = document.getElementsByClassName("nan-qa-correct")
	for (let i=0;i<EKUserAnswer.length;i++){
			EKUserAnswer[i].readOnly = false;
			EKUserAnswer[i].value = EKfinalAnswer[i].innerHTML
			EKUserAnswer[i].dispatchEvent(new Event('change'))
		}
        
    }
	
var alcBodyARRAY = document.getElementsByTagName("html")
var alcbody = alcBodyARRAY[0]
function domChange(){
    console.log("変化しました！");
}
/*
let observer = new MutationObserver(domChange);
let ;
observer.observe(alcBody, config);*/
//window.addEventListener("load", domChange, false)
var ELKLObserve = new MutationObserver(domChange)
const config = {childList: true,
				subtree: true,
				characterData: true,
				subtree: true
				}


/*ELKL.browser.runtime.onMessage.addListener(({ active }) => {
  if (active) {*/
    document.addEventListener('beforecopy', forceBrowserDefault, true);
	document.addEventListener('beforecut', forceBrowserDefault, true);
	//document.addEventListener('click', forceBrowserDefault, true);
	document.addEventListener('contextmenu', forceBrowserDefault, true);
	document.addEventListener('copy', forceBrowserDefault, true);
	document.addEventListener('dragstart', forceBrowserDefault, true);
	document.addEventListener('mousedown', forceBrowserDefault, true);
	document.addEventListener('mouseup', forceBrowserDefault, true);
    document.addEventListener('cut', forceBrowserDefault, true);
    document.addEventListener('paste', forceBrowserDefault, true);
	document.addEventListener('selectstart', forceBrowserDefault, true);
	document.addEventListener('click', CancelReadOnly, false);
	CancelReadOnly
	ELKLObserve.observe(alcbody,config)

	/*

	//ストリーム変更時にいいねを消し去る
function ObserveStream(){
    //オブザーバーの作成
    var observer = new MutationObserver(CancelReadOnly);
    //監視の開始
    observer.observe(document.getElementsByTagName('textarea')[0], {
        attributes: true,
        childList:  true
    });
    CancelReadOnly();
} 
//body変更時にObserveStreamを設定する。
//オブザーバーの作成
var observer = new MutationObserver(ObserveStream);
//監視の開始
observer.observe(document.getElementsByTagName('textarea'), {
    attributes: true
});
*/

 /* } else {    
    document.removeEventListener('beforecopy', forceBrowserDefault, true);
	document.removeEventListener('beforecut', forceBrowserDefault, true);
	document.removeEventListener('click', forceBrowserDefault, true);
	document.removeEventListener('contextmenu', forceBrowserDefault, true);
	document.removeEventListener('copy', forceBrowserDefault, true);
	document.removeEventListener('dragstart', forceBrowserDefault, true);
	document.removeEventListener('mousedown', forceBrowserDefault, true);
	document.removeEventListener('mouseup', forceBrowserDefault, true);
    document.removeEventListener('cut', forceBrowserDefault, true);
    document.removeEventListener('paste', forceBrowserDefault, true);
	document.removeEventListener('selectstart', forceBrowserDefault, true);

  }
});
*/
//ELKL.browser.runtime.sendMessage({ didLoad: true });
