module.exports = {
  apps: [
    {
      name: 'hotwheels-dev',
      script: 'cmd',
      args: '/c npm run dev',
      cwd: './',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
};

