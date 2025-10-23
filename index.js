const express =require('express');
const app = express();
const path = require('path')
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();
const docusign = require('docusign-esign');
const fs = require('fs');
const session = require('express-session');

app.use(session({
    secret: 'dfsf94835asda',
    resave: true,
    saveUninitialized: true
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/form', async (request, response) => {    
    console.log('Form Data Received:', request.body);
    await checkToken(request);
   let envelopesApi = getEnvelopesApi(request);
   let envelope = makeEnvelope(request.body.name, request.body.email, request.body.company);

   let results = await envelopesApi.createEnvelope(
       process.env.ACCOUNT_ID, {envelopeDefinition: envelope});
   console.log("envelope results ", results);
// Create the recipient view, the Signing Ceremony
   let viewRequest = makeRecipientViewRequest(request.body.name, request.body.email);
   results = await envelopesApi.createRecipientView(process.env.ACCOUNT_ID, results.envelopeId,
       {recipientViewRequest: viewRequest});
    response.redirect(results.url);
});

function makeRecipientViewRequest(name, email) {

   let viewRequest = new docusign.RecipientViewRequest();

   viewRequest.returnUrl = "http://localhost:8000/success";
   viewRequest.authenticationMethod = 'none';

   // Recipient information must match embedded recipient info
   // we used to create the envelope.
   viewRequest.email = email;
   viewRequest.userName = name;
   viewRequest.clientUserId = process.env.CLIENT_USER_ID;

   return viewRequest
}

function makeEnvelope(name, email, company){
   let env = new docusign.EnvelopeDefinition();
   env.templateId = process.env.TEMPLATE_ID;
   let text = docusign.Text.constructFromObject({
      tabLabel: "company_name", value: company});

   // Pull together the existing and new tabs in a Tabs object:
   let tabs = docusign.Tabs.constructFromObject({
      textTabs: [text],
   });

   let signer1 = docusign.TemplateRole.constructFromObject({
      email: email,
      name: name,
      tabs: tabs,
      clientUserId: process.env.CLIENT_USER_ID,
      roleName: 'Applicant'});

   env.templateRoles = [signer1];
   env.status = "sent";

   return env;
}

/**
 * Creates document 1
 * @function
 * @private
 * @param {Object} args parameters for the envelope
 * @returns {string} A document in HTML format
 */

function document1(args) {
  // Data for this method
  // args.signerEmail
  // args.signerName
  // args.ccEmail
  // args.ccName

  return `
    <!DOCTYPE html>
    <html>
        <head>
          <meta charset="UTF-8">
        </head>
        <body style="font-family:sans-serif;margin-left:2em;">
        <h1 style="font-family: 'Trebuchet MS', Helvetica, sans-serif;
            color: darkblue;margin-bottom: 0;">World Wide Corp</h1>
        <h2 style="font-family: 'Trebuchet MS', Helvetica, sans-serif;
          margin-top: 0px;margin-bottom: 3.5em;font-size: 1em;
          color: darkblue;">Order Processing Division</h2>
        <h4>Ordered by ${args.signerName}</h4>
        <p style="margin-top:0em; margin-bottom:0em;">Email: ${args.signerEmail}</p>
        <p style="margin-top:0em; margin-bottom:0em;">Copy to: ${args.ccName}, ${args.ccEmail}</p>
        <p style="margin-top:3em;">
  Candy bonbon pastry jujubes lollipop wafer biscuit biscuit. Topping brownie sesame snaps sweet roll pie. Croissant danish biscuit soufflé caramels jujubes jelly. Dragée danish caramels lemon drops dragée. Gummi bears cupcake biscuit tiramisu sugar plum pastry. Dragée gummies applicake pudding liquorice. Donut jujubes oat cake jelly-o. Dessert bear claw chocolate cake gummies lollipop sugar plum ice cream gummies cheesecake.
        </p>
        <!-- Note the anchor tag for the signature field is in white. -->
        <h3 style="margin-top:3em;">Agreed: <span style="color:white;">**signature_1**/</span></h3>
        </body>
    </html>
  `;
}


async function checkToken(req) {
    if (req.session.accessToken && req.session.expires_at > Date.now()) {
        console.log('reusing access token from session', req.session.accessToken);
    } else {
        console.log('generating new access token');
        let dsApiClient = new docusign.ApiClient();
        dsApiClient.setBasePath(process.env.BASE_PATH);
        const results = await dsApiClient.requestJWTUserToken
        (process.env.INTEGRATION_KEY, process.env.userId, 'signature',
            fs.readFileSync(path.join(__dirname, 'private.key')), 3600);

        console.log('Token:', results.body.access_token);
        req.session.accessToken = results.body.access_token;
        req.session.expires_at = Date.now() + (results.body.expires_in - 60) * 1000;
    }
}

function getEnvelopesApi(request){
    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath(process.env.BASE_PATH);
    dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + request.session.accessToken);
    return new docusign.EnvelopesApi(dsApiClient);
}



app.get('/', async (req, res) => {
    await checkToken(req)
    res.sendFile(path.join(__dirname, 'main.html'));
});

app.get('/success', (request, response) => {
    response.send('Signing completed successfully! You can close this window.');
});

app.listen(8000, () => {
    console.log('Server is running on http://localhost:8000', process.env.userId);
});


//  https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=b7ebda26-21c5-442a-b8cb-c9fc27444ae4&redirect_uri=http://localhost:8000/

