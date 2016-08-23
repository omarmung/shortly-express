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

var bcrypt = require('bcrypt');
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
  name: 'sessionId',
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

app.get('/signup', function(req, res) {
  res.render('signup');
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
  var username = req.body.username;
  var password = req.body.password;
  
 //  var salt = bcrypt.genSaltSync(10);
  


  new User({ username: username }).fetch().then(function(found) {
    if (found) {
      var salt = found.attributes.salt;
      var hash = bcrypt.hashSync(password, salt);
      var hashedPass = found.attributes.password;
      if (hash === hashedPass) {
        req.session.regenerate(function() {
          req.session.user = found.attributes.username;
          res.status(200).redirect('/'); 
        });
      } else {
        res.setHeader('location', '/login');
        return res.sendStatus(200);
      }
    } else {
      res.redirect('/signup');
      return res.sendStatus(200);
    }
  });

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

app.get('/login', function(req, res) {
  res.render('login');
  res.end(200);
});

app.post('/signup', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  var salt = bcrypt.genSaltSync(10);
  var hash = bcrypt.hashSync(password, salt);

  new User({ username: username }).fetch().then(function(found) {
    if (found) {
      // User already found in DB.
      // TODO: throw error, user already exists
      res.status(200).send(found.attributes);
    } else {
      Users.create({
        username: username,
        password: hash,
        salt: salt
      })
      .then(function(newUser) {
        res.status(200).redirect('/');
      });
    }
  });
});

app.post('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('/');
  });
});


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
