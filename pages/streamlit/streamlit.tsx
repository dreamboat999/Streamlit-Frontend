import React, { useState, useEffect } from 'react';
import {
  withStreamlitConnection,
  ComponentProps,
  Streamlit,
} from 'streamlit-component-lib';

import STORAGE from '../../utils/storage';

// All values in seconds
const HEARTBEAT_INTERVAL_SECONDS = 2;

const FRAME_HEIGHT = 50;

const StreamlitComponent = (props: ComponentProps) => {
  console.log('======== Streamlit component ========');

  const getSessionInfo = async () => {
    const sessionInfoStr = await STORAGE.getItem('sessionInfo');
    if (sessionInfoStr) {
      const sessionInfo = JSON.parse(String(sessionInfoStr));
      const me = sessionInfo.user;
      if (me) {
        const name =
          me.name ||
          `${me.given_name} ${me.family_name}` ||
          me.nickname ||
          me.email;
        const email = me.email || me.sub;
        const user = { user: me, name: name, email: email };
        const token = sessionInfo.token; // {value: accessToken, value_id_token: idToken, expiry: tokenExpiresAt}
        console.log('STC getSessionInfo (user): ' + JSON.stringify(user));
        console.log('STC getSessionInfo (token): ' + JSON.stringify(token));
        return { user: user, token: token };
      }
    }
    console.log('STC getSessionInfo (NULL)');
    return { user: null, token: null };
  };

  const [heartbeater, setHeartbeater] = useState(true);
  const [auth0LoginWindow, setAuth0LoginWindow] = useState(null);

  const [hostname, setHostname] = useState('None');
  const [message, setMessage] = useState('None');
  const [sessionInfo, setSessionInfo] = useState({ user: null, token: null });
  const [state, setState] = useState({
    hostname: hostname,
    message: message,
    isError: false,
    error: null,
    sessioninfo: null,
  });

  const initializeProps = async (props: ComponentProps) => {
    if ('hostname' in props.args && 'initial_state' in props.args) {
      console.log('STC initializeProps');
      setHostname(props.args.hostname);
      setMessage(props.args.initial_state['message']);
      delete props.args.hostname;
      delete props.args.initial_state;
    }
  };

  const sendEvent = async (name: string, data: any) => {
    if (props.args.events.includes(name)) {
      Streamlit.setComponentValue({ name: name, data: data });
    } else {
      Streamlit.setComponentValue({ name: 'onError', data: data });
    }
  };

  const updateStateAndNotifyHost = async (
    msg: string = null,
    error: string = null
  ) => {
    setMessage(msg || message);
    try {
      const currSessionInfo = await getSessionInfo();
      setSessionInfo(currSessionInfo);
      const currState = {
        hostname: hostname,
        message: msg || message,
        isError: false,
        error: error,
        sessioninfo: currSessionInfo,
      };
      setState(currState);
      await sendEvent('onStatusUpdate', currState);
    } catch (err) {
      console.log(`updateStateAndNotifyHost error: ${err}`);
    }
  };

  // !! This function is the main driver of events in this component !!
  // Must be run inside useEffect hook... see below hook with heartbeater dependency
  // (i.e. runs everytime the beat pulses)
  const listenForAuthChangeAndNotifyHost = async () => {
    const heartbeat = setTimeout(async () => {
      const currSessionInfo = await getSessionInfo();
      console.log(`>> STC BEAT <<`);
      if (
        (sessionInfo?.token?.value || null) !==
        (currSessionInfo?.token?.value || null)
      ) {
        // logged in change
        if (currSessionInfo?.token?.value) {
          console.log('STC User, Token, Expiry set on login');
          updateStateAndNotifyHost('Logged in');
          // logged out change
        } else {
          console.log('STC User, Token, Expiry cleared on logout');
          updateStateAndNotifyHost('Logged out');
        }
        handleLoginWindowCloser();
      }

      // Ping the component API every second beat to keep the server alive!
      if (heartbeater) {
        const resp = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/ping`
        );
        const ping = await resp.json();
        console.log(ping);
      }

      // Simulate a pulse by flip-flopping the flag; this drives the useEffect hook
      setHeartbeater(!heartbeater);
    }, HEARTBEAT_INTERVAL_SECONDS * 1000);

    return heartbeat;
  };

  useEffect(() => {
    const heartbeat = listenForAuthChangeAndNotifyHost();
    // @ts-ignore
    heartbeat.then(() => clearTimeout());
  }, [heartbeater]);

  // One shot initializer for props
  useEffect(() => {
    initializeProps(props);
    Streamlit.setFrameHeight(FRAME_HEIGHT);
  }, []);

  // One shot initializer for state
  useEffect(() => {
    const initState = async () => {
      try {
        const currSessionInfo = await getSessionInfo();
        setSessionInfo(currSessionInfo);
      } catch (err) {
        console.log(`useEffect initializer error: ${err}`);
      }
    };
    initState();
  }, []);

  useEffect(() => {
    updateStateAndNotifyHost();
  }, [hostname]);

  // ----------------------------------------------------

  // Many examples here: https://stackoverflow.com/questions/847185/convert-a-unix-timestamp-to-time-in-javascript
  const timestampToDateString = (timestamp: string): string => {
    const a = new Date(parseInt(timestamp) * 1000);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const year = a.getFullYear();
    const month = months[a.getMonth()];
    const date = a.getDate();
    const hour = a.getHours();
    const min = a.getMinutes();
    const sec = a.getSeconds();
    const time =
      date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec;
    return time;
  };

  const handleLoginWindowOpener = async () => {
    const W = 400;
    const H = 710;

    // Fixes dual-screen position                             Most browsers      Firefox
    const dualScreenLeft =
      window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const dualScreenTop =
      window.screenTop !== undefined ? window.screenTop : window.screenY;

    const width = window.innerWidth
      ? window.innerWidth
      : document.documentElement.clientWidth
      ? document.documentElement.clientWidth
      : screen.width;
    const height = window.innerHeight
      ? window.innerHeight
      : document.documentElement.clientHeight
      ? document.documentElement.clientHeight
      : screen.height;

    const systemZoom = 1;
    // const systemZoom = width / window.screen.availWidth
    const left = (width - W) / 2 / systemZoom + dualScreenLeft;
    const top = (height - H) / 2 / systemZoom + dualScreenTop;
    const settings = `scrollbars=yes, width=${W / systemZoom}, height=${
      H / systemZoom
    }, top=${top}, left=${left}`;
    // console.log(settings)
    // const popup = window.open('/', '_auth0_login', settings);
    const popup = sessionInfo.user
      ? window.open('/api/auth/logout', '_auth0_login', settings)
      : window.open('/api/auth/login', '_auth0_login', settings);

    if (window.focus) popup.focus();

    setAuth0LoginWindow(popup);
  };

  const handleLoginWindowCloser = async () => {
    if (auth0LoginWindow) {
      auth0LoginWindow.close();
      setAuth0LoginWindow(null);
      // setTimeout(() => { auth0LoginWindow.close(); setAuth0LoginWindow(null); }, 500);
    }
  };

  // ----------------------------------------------------

  return (
    <header className='flex items-center gap-4'>
      <button
        onClick={handleLoginWindowOpener}
        // onClick={handleAuthentication}
        className='border border-pink-700 rounded-md px-8 py-2 hover:bg-pink-700 duration-300'
      >
        {sessionInfo.user ? 'Logout' : 'Login'}
      </button>
      <span>|</span>
      <span className='text-md text-gray-600'>
        {hostname}{' '}
        {sessionInfo.token?.expiry
          ? ` (Current login valid till ${timestampToDateString(
              sessionInfo.token.expiry
            )})`
          : ' (Logged out)'}
      </span>
    </header>
  );
};

export default withStreamlitConnection(StreamlitComponent);
