// Background Service Worker
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'openPastaWindow') {
        chrome.windows.create({ url: message.url, width: 1200, height: 800, type: 'popup' });
    }
});
