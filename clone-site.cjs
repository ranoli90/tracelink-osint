const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const baseUrl = 'https://www.ableroof.com';
const outputDir = 'C:\\Users\\Administrator\\Desktop\\able-roof';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const visited = new Set();
const failed = new Set();
const assets = new Set();

// Common asset extensions to download
const assetExtensions = [
    '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 
    '.woff', '.woff2', '.ttf', '.eot', '.otf', '.webp', '.mp4', '.webm',
    '.pdf', '.zip', '.ico'
];

function isAssetUrl(url) {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    return assetExtensions.some(ext => pathname.toLowerCase().endsWith(ext));
}

function shouldProcessUrl(url) {
    try {
        const parsedUrl = new URL(url);
        // Only process URLs from ableroof.com
        if (!parsedUrl.hostname.includes('ableroof.com')) {
            return false;
        }
        // Skip WP admin, login, etc
        if (parsedUrl.pathname.includes('/wp-admin/') || 
            parsedUrl.pathname.includes('/wp-login') ||
            parsedUrl.pathname.includes('/wp-json/')) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

function getFilePath(url) {
    const parsedUrl = new URL(url);
    let pathname = parsedUrl.pathname;
    
    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
    }
    
    // Handle query strings for cache-busting URLs
    const filePath = pathname.split('?')[0];
    
    // Ensure directories end with index.html
    if (filePath.endsWith('/')) {
        return path.join(outputDir, filePath, 'index.html');
    }
    
    return path.join(outputDir, filePath);
}

function ensureDirectory(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function downloadFile(url, retries = 3) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        const req = protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = new URL(res.headers.location, url).toString();
                resolve(downloadFile(redirectUrl, retries));
                return;
            }
            
            if (res.statusCode !== 200) {
                if (retries > 0) {
                    setTimeout(() => {
                        resolve(downloadFile(url, retries - 1));
                    }, 1000);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
                return;
            }
            
            const filePath = getFilePath(url);
            ensureDirectory(filePath);
            
            const writeStream = fs.createWriteStream(filePath);
            res.pipe(writeStream);
            
            writeStream.on('finish', () => {
                writeStream.close();
                console.log(`Downloaded: ${url} -> ${filePath}`);
                resolve(filePath);
            });
            
            writeStream.on('error', (err) => {
                fs.unlink(filePath, () => {});
                reject(err);
            });
        });
        
        req.on('error', (err) => {
            if (retries > 0) {
                setTimeout(() => {
                    resolve(downloadFile(url, retries - 1));
                }, 1000);
            } else {
                reject(err);
            }
        });
        
        req.setTimeout(30000, () => {
            req.destroy();
            if (retries > 0) {
                setTimeout(() => {
                    resolve(downloadFile(url, retries - 1));
                }, 1000);
            } else {
                reject(new Error('Request timeout'));
            }
        });
    });
}

async function processPage(url) {
    if (visited.has(url)) return;
    visited.add(url);
    
    console.log(`\nProcessing: ${url}`);
    
    try {
        const filePath = await downloadFile(url);
        
        // Read the downloaded file and extract links
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Extract all links from HTML
        const linkRegex = /href=["']([^"']+)["']/g;
        let match;
        const links = [];
        
        while ((match = linkRegex.exec(content)) !== null) {
            const link = match[1];
            if (link.startsWith('http') && shouldProcessUrl(link)) {
                links.push(link);
            } else if (link.startsWith('/') || link.startsWith('./') || link.startsWith('../')) {
                try {
                    const absoluteUrl = new URL(link, url).toString();
                    if (shouldProcessUrl(absoluteUrl)) {
                        links.push(absoluteUrl);
                    }
                } catch {}
            }
        }
        
        // Extract all asset URLs from src attributes
        const srcRegex = /src=["']([^"']+)["']/g;
        while ((match = srcRegex.exec(content)) !== null) {
            const src = match[1];
            if (src.startsWith('http') && shouldProcessUrl(src)) {
                links.push(src);
            } else if (src.startsWith('/') || src.startsWith('./') || src.startsWith('../')) {
                try {
                    const absoluteUrl = new URL(src, url).toString();
                    if (shouldProcessUrl(absoluteUrl)) {
                        links.push(absoluteUrl);
                    }
                } catch {}
            }
        }
        
        // Process discovered links
        for (const link of links) {
            if (!visited.has(link)) {
                // Check if it's an asset or page
                if (isAssetUrl(link) || link.includes('/wp-content/')) {
                    if (!assets.has(link)) {
                        assets.add(link);
                        try {
                            await downloadFile(link);
                        } catch (err) {
                            console.log(`Failed to download asset: ${link} - ${err.message}`);
                            failed.add(link);
                        }
                    }
                } else {
                    await processPage(link);
                }
            }
        }
        
    } catch (err) {
        console.log(`Failed to process ${url}: ${err.message}`);
        failed.add(url);
    }
}

// Main execution
async function main() {
    console.log(`Starting download from ${baseUrl}`);
    console.log(`Output directory: ${outputDir}`);
    
    // First, get the main page
    await processPage(baseUrl);
    
    // Also try common WordPress paths
    const commonPaths = [
        '/roofing/',
        '/services/',
        '/about/',
        '/contact/',
        '/blog/',
        '/areas-we-serve/',
        '/service-areas/'
    ];
    
    for (const p of commonPaths) {
        await processPage(baseUrl + p);
    }
    
    console.log('\n=== Download Summary ===');
    console.log(`Total pages processed: ${visited.size}`);
    console.log(`Total assets downloaded: ${assets.size}`);
    console.log(`Failed URLs: ${failed.size}`);
    
    if (failed.size > 0) {
        console.log('\nFailed URLs:');
        for (const url of failed) {
            console.log(`  - ${url}`);
        }
    }
    
    console.log('\nDownload complete!');
}

main().catch(console.error);
