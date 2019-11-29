import React from 'react';
import Navbar from './Navbar';
import WebXRApp from './WebXRApp';
import AvatarsApp from './WebXRApps/avatars-master/index.html';
import BrowserApp from './WebXRApps/exokit-browser-master/index.html';
import { BrowserRouter as Router, Route } from "react-router-dom";

const App = props => {
  return (
    <Router>
      <div className="App">
        <Route path="/" component={props => <Navbar />} />
        <Route path="/avatars" component={props => <WebXRApp app={AvatarsApp} appFolder="avatars-master" />} />
        <Route path="/browser" component={props => <WebXRApp app={BrowserApp} appFolder="exokit-browser-master" />} />
      </div>
    </Router>
  );
}

export default App;