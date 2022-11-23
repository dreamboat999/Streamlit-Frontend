import Link from 'next/link';
import { useEffect, useState } from 'react';
import Head from 'next/head';

import STORAGE from '../utils/storage';

export default function AuthApp({ session }) {
  console.log('======== AuthApp ========');

  // Initialy there will be no session, then the post-login callback will pass in the session object
  const [sessionInfo, setSessionInfo] = useState({
    user: session?.user,
    token: {
      value: session?.accessToken,
      value_id_token: session?.idToken,
      expiry: session?.accessTokenExpiresAt,
    },
  });

  console.log(session ? session.user : 'Null user');
  console.log(session ? session.idToken : 'Null id token');
  console.log(session ? session.accessToken : 'Null access token');
  console.log(session ? session.accessTokenExpiresAt : 'Null token expiry');

  useEffect(() => {
    setSessionInfo({
      user: session?.user,
      token: {
        value: session?.accessToken,
        value_id_token: session?.idToken,
        expiry: session?.accessTokenExpiresAt,
      },
    });
  }, []);

  useEffect(async () => {
    if (sessionInfo.user?.email) {
      console.log('AuthApp (set session info: user, token, expiry)');
      await STORAGE.setItem('sessionInfo', JSON.stringify(sessionInfo));
    } else {
      console.log('AuthApp (remove session info: user, token, expiry)');
      await STORAGE.removeItem('sessionInfo');
    }
  }, [sessionInfo]);

  const ButtonLinkStyle = `border border-pink-700 rounded-md px-6 py-2 hover:bg-pink-700 hover:text-white duration-300`;

  return (
    <div>
      <Head>
        <title>Authentication</title>
      </Head>
      <main>
        <div className='flex flex-col p-10'>
          <img src='/logo.png' width='80px' height='80px' />
          {!sessionInfo.user?.email && (
            <div className='flex flex-col gap-5'>
              <p className='text-xl'>Sign into application....</p>
              <div>
                <Link href='/api/auth/login' passHref>
                  <a className={ButtonLinkStyle}>Login</a>
                </Link>
              </div>
            </div>
          )}
          {sessionInfo.user?.email && (
            <div className='flex flex-col gap-3'>
              <p className='font-bold text-2xl'>Signed in</p>
              <span>Return to the application, or sign out...</span>
              <div className='py-3'>
                <Link href='/api/auth/logout' passHref>
                  <a className={ButtonLinkStyle}>Logout</a>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
