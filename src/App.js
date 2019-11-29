import React, { useEffect, useState } from 'react';
// import './App.css';
import Navbar from './Navbar';
import WebXRApp from './WebXRApp';
import AvatarsApp from './WebXRApps/avatars-master/index.html';
// import BrowserApp from './WebXRApps/exokit-browser-master/index.html';

import { parse } from 'node-html-parser';


const App = props => {

  useEffect(() => {
    const parsedHTML = parse(AvatarsApp);
    const scripts = parsedHTML.childNodes[0].querySelectorAll('script');
    console.log("WebXRApp: ", scripts)

    scripts.forEach(s => {
      console.log("loading:", s.rawAttrs)
      const script = document.createElement("script");
      if(s.attributes && s.attributes.src){
        script.src = `/WebXRApps/avatars-master/${s.attributes && s.attributes.src ? s.attributes.src : ""}`;
        script.async = false;
        document.body.appendChild(script);
      }
  })
})

  return (
    <div className="App">
      {/* <Navbar /> */}
      <WebXRApp html={{__html: AvatarsApp}} />
      {/* <WebXRApp html={{__html: BrowserApp}} /> */}
    </div>
  );
}

export default App;