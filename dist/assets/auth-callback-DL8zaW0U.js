import{p as o}from"./auth-B3oSFb2k.js";const e=o();e.error?(window.opener&&window.opener.postMessage({type:"oauth-error",error:e.error,errorDescription:e.errorDescription},window.location.origin),document.querySelector(".message").innerHTML=`
        <h1>Authentication Failed</h1>
        <p>${e.errorDescription||e.error}</p>
        <p>You can close this window.</p>
      `):e.accessToken||e.code?window.opener?(window.opener.postMessage({type:"oauth-success",accessToken:e.accessToken,code:e.code,state:e.state},window.location.origin),document.querySelector(".message").innerHTML=`
          <h1>Success!</h1>
          <p>Authentication complete. This window will close automatically...</p>
        `,setTimeout(()=>{window.close()},1e3)):(sessionStorage.setItem("oauth_callback",JSON.stringify(e)),window.location.href="/"):document.querySelector(".message").innerHTML=`
        <h1>No Authentication Data</h1>
        <p>You can close this window.</p>
      `;
//# sourceMappingURL=auth-callback-DL8zaW0U.js.map
