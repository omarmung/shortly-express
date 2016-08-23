var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

// Things we required
// From http://www.9bitstudios.com/2013/09/express-js-authentication/
// var cookie = require('./node_modules/cookie-parser');
// var bcrypt = require('./node_modules/bcrypt');
var session = require('express-session');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false 
  }
}));


var restrict = function(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
};


app.get('/', 
function(req, res) {
  restrict(req, res, function() {
    res.render('index'); 
  });
});

app.get('/create', 
function(req, res) {
  restrict(req, res, function() {
    res.render('index');
  });
});

app.get('/links', 
function(req, res) {
  restrict(req, res, function() {
    Links.reset().fetch().then(function(links) {
      res.status(200).send(links.models);
    });
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.post('/login', function(req, res) {
  var username = req.body.username; // req.body.username; ?
  var password = req.body.password; // req.body.password; ?
  res.sendStatus(200);
  // var salt = bcrypt.genSaltSync(10);
  // var hash = bcrypt.hashSync(password, salt);
  // var userObj = db.users.findOne({ username: username, password: hash });
  // if (userObj) {
  //   req.session.regenerate(function() {
  //     req.session.user = userObj.username;
  //     res.redirect('/restricted'); // example restricted route?
  //   });
  // } else {
  //   res.redirect('login');
  // }
});

// from http://www.9bitstudios.com/2013/09/express-js-authentication/
// app.get('/login', function(req, res) {
//   res.send('<some html stuff />');
// });

// from http://www.9bitstudios.com/2013/09/express-js-authentication/
// app.post('/logout', function(req, res) {
//   request.session.destroy(function() {
//     res.redirect('/');
//   });
// });

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
