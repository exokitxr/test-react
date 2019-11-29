const LAMBDA_URLS = {
    login: `https://login.exokit.org/`,
    token: `https://token.exokit.org/token`,
    tokens: `https://token.exokit.org/tokens`,
    coords: `https://token.exokit.org/coords`,
    presence: `wss://presence.exokit.org/`,
  };
  function parseQuery(s) {
    var query = {};
    var pairs = (s[0] === '?' ? s.substr(1) : s).split('&');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].split('=');
      query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
    return query;
  }
  async function doLogin(email, code) {
    const res = await fetch(LAMBDA_URLS.login + `?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`, {
      method: 'POST',
    });
    if (res.status >= 200 && res.status < 300) {
      const newLoginToken = await res.json();
  
      await storage.set('loginToken', newLoginToken);
  
      loginToken = newLoginToken;
  
      loginNameStatic.innerText = loginToken.name;
      loginEmailStatic.innerText = loginToken.email;
      if (loginToken.stripeConnectState) {
        statusConnected.classList.add('open');
        statusNotConnected.classList.remove('open');
        connectStripeButton.classList.remove('visible');
      } else {
        statusNotConnected.classList.add('open');
        statusConnected.classList.remove('open');
        connectStripeButton.classList.add('visible');
      }
  
      document.body.classList.add('logged-in');
      loginForm.classList.remove('phase-1');
      loginForm.classList.remove('phase-2');
      loginForm.classList.add('phase-3');
  
      return true;
    } else {
      return false;
    }
  }
  const storage = {
    async get(k) {
      const res = await fetch(`/.s/${k}`);
      if (res.status >= 200 && res.status < 300) {
        const s = await res.text();
        return JSON.parse(s);
      } else {
        return undefined;
      }
    },
    async set(k, v) {
      const res = await fetch(`/.s/${k}`, {
        method: 'PUT',
        body: JSON.stringify(v),
      });
      if (res.status >= 200 && res.status < 300) {
        // nothing
      } else {
        throw new Error(`invalid status code: ${res.status}`);
      }
    },
    async remove(k) {
      const res = await fetch(`/.s/${k}`, {
        method: 'DELETE',
      });
      if (res.status >= 200 && res.status < 300) {
        // nothing
      } else {
        throw new Error(`invalid status code: ${res.status}`);
      }
    },
  };
  
  let xrEngine;
  let loginToken = null;
  const q = parseQuery(window.location.search);
  const {key} = q;
  import(`https://web.exokit.org/ew.js${key ? `?key=${encodeURIComponent(key)}` : ''}`)
  // import(`./exokit-web/ew.js${key ? `?key=${encodeURIComponent(key)}` : ''}`)
    .then(async () => {
      if (navigator.serviceWorker.controller) { // avoid FOUC during reload
        // xrEngine = document.createElement('xr-engine');
        xrEngine = new XREngine();
        xrEngine.src = 'app.html';
        xrEngine.addEventListener('message', async e => {
          const {data} = e;
          const {method} = data;
          if (method === 'loadScene') {
            const res = await fetch('/.s/scene');
            if (res.status >= 200 && res.status < 300) {
              const html = await res.text();
              xrEngine.postMessage({
                method: 'loadScene',
                html,
              });
            } else if (res.status === 404) {
              xrEngine.postMessage({
                method: 'loadScene',
                html: null,
              });
            } else {
              console.warn(`invalid status code: ${res.status}`);
            }
          } else if (method === 'saveScene') {
            const {html} = data;
            const res = await fetch('/.s/scene', {
              method: 'PUT',
              headers: {
                'Content-Type': 'text/html',
              },
              body: html,
            });
            if (res.status >= 200 && res.status < 300) {
              // nothing
            } else {
              console.warn(`invalid status code: ${res.status}`);
            }
          }
        });
        document.body.appendChild(xrEngine);
  
        const {email, code} = q;
        if (email && code && await doLogin(email, code)) {
          delete q.email;
          delete q.code;
          window.location.search = '?' + Object.keys(q).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(q[k])).join('&');
          return;
        }
  
        const localLoginToken = await storage.get('loginToken');
        if (localLoginToken) {
          const res = await fetch(LAMBDA_URLS.login + `?email=${encodeURIComponent(localLoginToken.email)}&token=${encodeURIComponent(localLoginToken.token)}`, {
            method: 'POST',
          })
          if (res.status >= 200 && res.status < 300) {
            loginToken = await res.json();
  
            await storage.set('loginToken', loginToken);
  
            loginNameStatic.innerText = loginToken.name;
            loginEmailStatic.innerText = loginToken.email;
            if (loginToken.stripeConnectState) {
              statusConnected.classList.add('open');
              statusNotConnected.classList.remove('open');
              connectStripeButton.classList.remove('visible');
            } else {
              statusNotConnected.classList.add('open');
              statusConnected.classList.remove('open');
              connectStripeButton.classList.add('visible');
            }
  
            ga('create', 'UA-147624282-1', {
              'clientId': loginToken.email,
            });
            ga('send', 'event', 'Login', 'finished', 'Exokit Browser');
  
            document.body.classList.add('logged-in');
            loginForm.classList.remove('phase-1');
            loginForm.classList.remove('phase-2');
            loginForm.classList.add('phase-3');
          } else {
            await storage.remove('loginToken');
  
            console.warn(`invalid status code: ${res.status}`);
          }
        }
  
        xrEngine.postMessage({
          method: 'login',
          loginToken,
        });
  
        const {u, j} = q;
        if (u) {
          xrEngine.postMessage({
            method: 'loadScene',
            html: `<xr-site><xr-iframe src="${u}"></xr-iframe></xr-site>`,
          });
        }
        if (j) {
          const channelName = j;
          xrEngine.postMessage({
            method: 'joinChannel',
            channelName,
          });
        }
  
        let result;
        if (navigator.xr) {
          try {
            await navigator.xr.supportsSession('immersive-vr');
            result = true;
          } catch (err) {
            result = false;
          }
        } else {
          result = false;
        }
        if (result) {
          console.log('xr available');
          document.getElementById('enter-xr-button').style.display = null;
        } else {
          console.log('no xr');
          document.getElementById('no-xr-button').style.display = null;
        }
  
        document.body.classList.remove('logging-in');
      }
    })
    .catch(err => {
      console.warn(err);
    });
  
  // const loginButton = document.getElementById('login-button');
  // const loginButton2 = document.getElementById('login-button-2');
  // const loginPopdown = document.getElementById('login-popdown');
  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginNameStatic = document.getElementById('login-name-static');
  const loginEmailStatic = document.getElementById('login-email-static');
  const statusNotConnected = document.getElementById('status-not-connected');
  const statusConnected = document.getElementById('status-connected');
  const loginVerificationCode = document.getElementById('login-verification-code');
  const loginNotice = document.getElementById('login-notice');
  const loginError = document.getElementById('login-error');
  const logoutButton = document.getElementById('logout-button');
  const controlsDropdown = document.getElementById('controls-dropdown');
  const controlsPopdown = document.getElementById('controls-popdown');
  controlsDropdown.onclick = () => {
    controlsDropdown.classList.toggle('open');
    controlsPopdown.classList.toggle('open');
  };
  /* [loginButton, loginButton2].forEach(b => {
    b.onclick = () => {
      loginPopdown.classList.toggle('open');
    };
  });
  logoutButton.onclick = async () => {
    await storage.remove('loginToken');
  
    loginToken = null;
    xrEngine.postMessage({
      method: 'login',
      loginToken,
    });
    document.body.classList.remove('logged-in');
  }; */
  loginForm.onsubmit = async e => {
    e.preventDefault();
  
    if (loginForm.classList.contains('phase-1') && loginEmail.value) {
      loginNotice.innerHTML = '';
      loginError.innerHTML = '';
      loginForm.classList.remove('phase-1');
  
      const res = await fetch(LAMBDA_URLS.login + `?email=${encodeURIComponent(loginEmail.value)}`, {
        method: 'POST',
      })
      if (res.status >= 200 && res.status < 300) {
        loginNotice.innerText = `Code sent to ${loginEmail.value}!`;
        loginForm.classList.add('phase-2');
  
        return res.blob();
      } else if (res.status === 403) {
        loginError.innerText = `${loginEmail.value} is not in the beta yet :(`;
  
        loginForm.classList.add('phase-1');
      } else {
        throw new Error(`invalid status code: ${res.status}`);
      }
    } else if (loginForm.classList.contains('phase-2') && loginEmail.value && loginVerificationCode.value) {
      loginNotice.innerHTML = '';
      loginError.innerHTML = '';
      loginForm.classList.remove('phase-2');
  
      if (await doLogin(loginEmail.value, loginVerificationCode.value)) {
        xrEngine.postMessage({
          method: 'login',
          loginToken,
        });
      }
    } else if (loginForm.classList.contains('phase-3')) {
      await storage.remove('loginToken');
  
      window.location.reload();
  
      /* loginToken = null;
      xrEngine.postMessage({
        method: 'login',
        loginToken,
      });
  
      loginNotice.innerHTML = '';
      loginError.innerHTML = '';
      document.body.classList.remove('logged-in');
      loginForm.classList.remove('phase-3');
      loginForm.classList.add('phase-1'); */
    }
  };
  
  const enter2dButton = document.getElementById('enter-2d-button');
  enter2dButton.addEventListener('click', () => {
    xrEngine.postMessage({
      method: 'enter2d',
    });
  });
  const enterXrButton = document.getElementById('enter-xr-button');
  enterXrButton.addEventListener('click', () => {
    xrEngine.enterXr();
  });
  
  // const exploreLabel = document.getElementById('explore-label');
  // const exploreContent = document.getElementById('explore-content');
  const _getCoordsFromBindingUrl = bindingUrl => {
    const match = bindingUrl.match(/^\/\?c=(-?[0-9\.]+),(-?[0-9\.]+)$/);
    if (match) {
      const x = parseFloat(match[1]);
      const z = parseFloat(match[2]);
      if (isFinite(x) && isFinite(z)) {
        return [x, z];
      } else {
        return null;
      }
    } else {
      return null;
    }
  };
  const _makeElement = html => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.children[0];
  };
  const _getAppType = mimeType => {
    if (/^img\//.test(mimeType)) {
      return 'image';
    } else if (/^audio\//.test(mimeType)) {
      return 'audio';
    } else if (/^video\//.test(mimeType)) {
      return 'video';
    } else if (/^model\//.test(mimeType)) {
      return 'model';
    } else if (/^text\/html\+webgl$/.test(mimeType)) {
      return 'webgl';
    } else if (/^text\/html$/.test(mimeType)) {
      return 'html';
    } else {
      return null;
    }
  };
  const _renderItems = items => {
    const el = _makeElement(`<ul>
      ${items.map((item, index) => {
        const {type} = item;
        const coords = _getCoordsFromBindingUrl(item.bindingUrl);
        return `<li>
  
          <a id=img-${index+1}><img src="skin.png"></a>
          <div class=tag>
          ${(() => {
              switch (_getAppType(item.type)) {
                case 'image': return `<i class="fal fa-image"></i>`;
                case 'audio': return `<i class="fal fa-volume-up"></i>`;
                case 'video': return `<i class="fal fa-film"></i>`;
                case 'model': return `<i class="fal fa-dice-d4"></i>`;
                case 'webgl': return `<i class="fal fa-gamepad"></i>`;
                case 'html':
                default: return `<i class="fal fa-link"></i>`;
              }
            })()}
          </div>
          <div class=wrap>
            <h3>
              <a class="a-content" href="${item.url}" id=name-${index+1}>${item.name}</a>
              <div class=controls>
                <a id=control-edit-${index+1}><i class="fal fa-pencil"></i></a>
                <a id=control-move-${index+1}><i class="fal fa-crosshairs"></i></a>
                <a id=control-delete-${index+1}><i class="fal fa-trash-alt"></i></a>
              </div>
            </h3>
            <p><a id=owner-${index+1}><i class="fas fa-user"></i> ${item.addr.slice(0, 12)}</a> ${coords ? `<a class="a-binding" href="/?c=${coords.join(',')}" id=binding-${index+1}>at ${coords.join(',')}</a>` : `<a class="a-binding" id=binding-${index+1}><i class="fas fa-map-marker"></i> not bound</a>`}</p>
          </div>
        </li>`;
      }).join('')}
    </ul>`);
    const aBindings = el.querySelectorAll('.a-binding');
    for (let i = 0; i < aBindings.length; i++) {
      const a = aBindings[i];
      a.onclick = e => {
        e.preventDefault();
  
        history.pushState({}, a.href, a.href);
        _updateCoord();
      };
    }
    return el;
  };
  const _renderGamers = gamers => {
    const el = _makeElement(`<ul>
      ${gamers.map(gamer => {
        const {coords} = gamer;
        return `<li>
          <a id=img><img src="skin.png"></a>
          <div class=wrap>
            <h3>
              <a class="a-content" href="${gamer.name}" id=name>${gamer.name}</a>
            </h3>
            <p><a class="a-binding" href="/?c=${coords.join(',')}" id=coord><i class="fas fa-map-marker"></i> at ${coords.join(',')}</a></p>
          </div>
        </li>`;
      }).join('')}
    </ul>`);
    const aBindings = el.querySelectorAll('.a-binding');
    for (let i = 0; i < aBindings.length; i++) {
      const a = aBindings[i];
      a.onclick = e => {
        e.preventDefault();
  
        history.pushState({}, a.href, a.href);
        _updateCoord();
      };
    }
    return el;
  };
  /* const _updateTabs = async () => {
    if (currentExploreTab === 1) {
      const c = renderer.vr.enabled ? renderer.vr.getCamera(camera) : camera;
      const coords = [Math.floor((c.position.x + PARCEL_SIZE/2)/PARCEL_SIZE), Math.floor((c.position.z + PARCEL_SIZE/2)/PARCEL_SIZE)];
      const u = `${LAMBDA_URLS.coords}/${coords[0]}/${coords[1]}`;
  
      explorePopdown.classList.add('loading');
  
      const items = await fetch(u)
        .then(res => res.json())
        .catch(err => {
          console.warn(err.stack);
        });
  
      exploreLabel.innerText = 'Nearby';
      exploreContent.innerHTML = '';
      exploreContent.appendChild(_renderItems(items));
      explorePopdown.classList.remove('loading');
    } else if (currentExploreTab === 2) {
      const u = `${LAMBDA_URLS.tokens}/${encodeURIComponent(loginToken.addr)}`;
  
      explorePopdown.classList.add('loading');
  
      const items = await fetch(u)
        .then(res => res.json())
        .catch(err => {
          console.warn(err.stack);
        });
  
      exploreLabel.innerText = 'Inventory';
      exploreContent.innerHTML = '';
      exploreContent.appendChild(_renderItems(items));
      explorePopdown.classList.remove('loading');
    } else if (currentExploreTab === 3) {
      exploreLabel.innerText = 'Gamers';
      exploreContent.innerHTML = '';
      exploreContent.appendChild(_renderGamers([{
        name: 'Avaer',
        coords: [1.234, 2.567],
      }]));
      explorePopdown.classList.remove('loading');
    } else if (currentExploreTab === 4) {
      exploreLabel.innerText = '';
      exploreContent.innerHTML = '';
      exploreContent.appendChild(_makeElement(`<div class=url>
        <input type="text" placeholder="https://" id=url-input>
        <a id=go><i class="fal fa-plus-square"></i></a>
      </div>`));
      explorePopdown.classList.remove('loading');
    } else {
      // nothing
    }
  }; */
  
  /* const developersDropdown = document.getElementById('developers-dropdown');
  const developersPopdown = document.getElementById('developers-popdown');
  developersDropdown.onclick = () => {
    developersDropdown.classList.toggle('open');
    developersPopdown.classList.toggle('open');
  }; */
  
  const _stopPropagation = e => {
    e.stopPropagation();
  };
  const header = document.getElementById('header');
  header.addEventListener('mousedown', _stopPropagation);
  header.addEventListener('dblclick', _stopPropagation);
  
  const submitSiteUrlBar = document.getElementById('site-url-bar');
  const submitSiteButton = document.getElementById('submit-site');
  submitSiteButton.addEventListener('click', () => {
    if (/^https:\/\//.test(submitSiteUrlBar.value)) {
      const url = submitSiteUrlBar.value;
      window.location.href = `https://github.com/exokitxr/exoland/issues/new?title=${encodeURIComponent(`[ADD-WORLD] ${url}`)}&assignee=modulesio&labels=add-world&body=${encodeURIComponent('URL to add:\n\n```' + url + '```')}`;
    } else {
      console.warn('only https sites are supported: ' + submitSiteUrlBar.value);
    }
  });
  const connectStripeButton = document.getElementById('connect-stripe-button');
  connectStripeButton.addEventListener('click', () => {
    window.location.href = `https://payments.exokit.org/authorize?email=${encodeURIComponent(loginToken.email)}&token=${encodeURIComponent(loginToken.token)}&redirectUrl=${window.location.href}`;
  });
  const disconnectStripeButton = document.getElementById('disconnect-stripe-button');
  disconnectStripeButton.addEventListener('click', () => {
    const {email, token} = loginToken;
    fetch(`https://payments.exokit.org/untoken?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`)
      .then(async res => {
        if (res.status >= 200 && res.status < 300) {
          loginToken.stripeConnectState = false;
          statusNotConnected.classList.add('open');
          statusConnected.classList.remove('open');
          connectStripeButton.classList.add('visible');
  
          await storage.set('loginToken', loginToken);
        } else {
          console.warn('invalid status code', res.status);
        }
      });
  });
  
  const userButton = document.getElementById('user-button');
  const userAccount = document.getElementById('user-account');
  userButton.addEventListener('click', () => {
    userButton.classList.toggle('open');
    userAccount.classList.toggle('open');
  });