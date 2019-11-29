import React, { useEffect } from 'react';
import { parse } from 'node-html-parser';

const WebXRApp = props => {

   useEffect(() => {
      const parsedHTML = parse(props.app);
      const scripts = parsedHTML.childNodes[0].querySelectorAll('script');

      scripts.forEach(s => {
         console.log("loading:", s.rawAttrs)
         const script = document.createElement("script");
         if (s.attributes && s.attributes.src) {
            let src = `/WebXRApps/${props.appFolder}/${s.attributes && s.attributes.src ? s.attributes.src : ""}`
            script.type = "module"
            if(s.attributes.src.slice(0, 4) === "http"){
               src = s.attributes && s.attributes.src ? s.attributes.src : ""
               script.type = "async"
            }
            script.src = src;
            script.async = false;
            document.body.appendChild(script);
         }
      })
   })
   return <div dangerouslySetInnerHTML={{ __html: props.app }} />
}
export default WebXRApp;