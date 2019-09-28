require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const rimraf = require('rimraf');
const showdown = require('showdown'),
  converter = new showdown.Converter();
const winston = require('winston');

const logger = winston.createLogger({
    transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
    ]
});

async function walk(dir) {
    let files = await fs.readdir(dir);
    files = await Promise.all(files.map(async file => {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) return walk(filePath);
        else if(stats.isFile()) return filePath;
    }));

    return files.reduce((all, folderContents) => all.concat(folderContents), []);
}

async function convert(from, to, header, footer) {
  var text = await fs.readFile(from, 'utf8');
  var html = header + converter.makeHtml(text) + footer;
  await fs.writeFile(to, html);
}

async function deploy(src, dest) {
  var header = await fs.readFile(process.env.header, 'utf8');
  var footer = await fs.readFile(process.env.footer, 'utf8');
  let files = await walk(src);
  logger.debug('Deleting destination: ' + dest);
  rimraf.sync(dest);
  try {
    logger.debug('Making destination folder: ' + dest);
    fs.mkdir(dest, { recursive: true });
  } catch(err) {}
  for (var i=0; i<files.length; i++) {
    var file = files[i];
    var rel = path.relative(src, file);
    var target = path.join(dest, rel);
    var folder = path.dirname(target);
    var base = path.basename(target, '.md');
    var ext = path.extname(file);
    await fs.mkdir(folder, { recursive: true });
    if (ext === '.md') {
      var targetHtml = path.join(folder, base + '.html');
      logger.info('Converting ' + file + ' to ' + targetHtml);
      await convert(file, targetHtml, header, footer);
    } else {
      logger.info('Copying ' + file + ' to ' + target);
      await fs.copyFile(file, target);
    }
  }
}

deploy(process.env.src, process.env.dest).then();