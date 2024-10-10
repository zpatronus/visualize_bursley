// ==UserScript==
// @name         Food Item Tools for UMich Dining with Google Image API and Section-Specific Search
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Adds buttons to copy food name to clipboard, search in Google Images, and automatically display images using Google Image Search API for specific sections in UMich Dining's Bursley page. The API key and daily API request count are stored persistently in localStorage.
// @author       zPatronus
// @match        https://dining.umich.edu/menus-locations/dining-halls/bursley/*
// @grant        GM_xmlhttpRequest
// @connect      www.googleapis.com
// @updateURL    https://github.com/zpatronus/visualize_bursley/raw/main/visualize_bursley.user.js
// @downloadURL  https://github.com/zpatronus/visualize_bursley/raw/main/visualize_bursley.user.js
// ==/UserScript==

(function () {
  'use strict';

  const CX = '51db3fa032b5d4485';  // Your Custom Search Engine ID
  let apiKey = localStorage.getItem('googleApiKey') || '';  // Get API key from localStorage or set to empty
  let apiCounter = JSON.parse(localStorage.getItem('apiCounterData')) || { count: 0, date: new Date().toDateString() };  // API request count and date stored in localStorage

  const MAX_API_REQUESTS = 100;
  const autoSearchSections = ["Signature Maize", "Halal", "Two Oceans"];

  // Check if it's a new day and reset the counter if needed
  function checkAndResetApiCounter () {
    const today = new Date().toDateString();
    if (apiCounter.date !== today) {
      apiCounter = { count: 0, date: today };
      localStorage.setItem('apiCounterData', JSON.stringify(apiCounter));
    }
  }

  // Function to create buttons and handle actions
  function addButtonsToFoodItems () {
    const foodSections = document.querySelectorAll('h4'); // Target the section headers
    foodSections.forEach(section => {
      const sectionName = section.textContent.trim();
      const foodItems = section.nextElementSibling.querySelectorAll('li'); // Target food items within each section

      foodItems.forEach(item => {
        const foodNameDiv = item.querySelector('.item-name');
        if (foodNameDiv) {
          const foodName = foodNameDiv.textContent.trim();
          console.log('Processing food item:', foodName);

          const buttonContainer = document.createElement('div');
          buttonContainer.style.marginTop = '5px';

          const copyButton = document.createElement('button');
          copyButton.innerText = 'Copy';
          copyButton.style.marginRight = '5px';
          copyButton.style.fontSize = '0.8em';
          copyButton.style.padding = '2px 5px';
          copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(foodName);
            console.log(`Copied food name to clipboard: ${foodName}`);
          });

          const searchButton = document.createElement('button');
          searchButton.innerText = 'Search Image';
          searchButton.style.fontSize = '0.8em';
          searchButton.style.padding = '2px 5px';
          searchButton.addEventListener('click', () => {
            const googleSearchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(foodName)}`;
            window.open(googleSearchUrl, '_blank');
            console.log(`Opened Google Images for: ${foodName}`);
          });

          buttonContainer.appendChild(copyButton);
          buttonContainer.appendChild(searchButton);
          item.querySelector('a').insertAdjacentElement('afterend', buttonContainer);

          if (autoSearchSections.includes(sectionName) && apiKey && apiCounter.count < MAX_API_REQUESTS) {
            fetchGoogleImages(foodName, item);
          } else if (autoSearchSections.includes(sectionName) && !apiKey) {
            console.log('API key not provided. Auto search is disabled.');
          } else if (apiCounter.count >= MAX_API_REQUESTS) {
            console.log('API request limit reached. Auto search disabled.');
          }
        }
      });
    });

    displayApiCounter();
  }

  // Function to fetch 5 images using Google Custom Search API
  function fetchGoogleImages (query, itemElement) {
    const googleSearchUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${CX}&key=${apiKey}&searchType=image&num=5`;

    // Check if the API request limit has been reached
    if (apiCounter.count >= MAX_API_REQUESTS) {
      console.log('API request limit reached. Cannot perform search.');
      return;
    }

    GM_xmlhttpRequest({
      method: 'GET',
      url: googleSearchUrl,
      onload: function (response) {
        try {
          const data = JSON.parse(response.responseText);
          console.log('Google Custom Search API response:', data);

          if (data.items && data.items.length > 0) {
            const imageContainer = document.createElement('div');
            imageContainer.style.marginTop = '10px';

            // Append the first 5 thumbnails and maintain aspect ratio
            data.items.forEach((imageResult, index) => {
              if (imageResult.image && imageResult.image.thumbnailLink) {
                const img = document.createElement('img');
                img.src = imageResult.image.thumbnailLink;
                img.alt = `${query} image ${index + 1}`;
                img.style.maxWidth = '100px';   // Max width set to 100px
                img.style.maxHeight = '100px';  // Max height set to 100px
                img.style.marginRight = '5px';
                img.style.objectFit = 'contain';  // Maintain aspect ratio

                imageContainer.appendChild(img);
              }
            });

            console.log(`Appending images for: ${query}`);
            itemElement.appendChild(imageContainer);
          } else {
            console.warn(`No images found for: ${query}`);
          }
        } catch (error) {
          console.error('Error parsing Google API response for:', query, 'Error:', error);
        } finally {
          // Increment and store API counter, even for failed requests
          apiCounter.count++;
          localStorage.setItem('apiCounterData', JSON.stringify(apiCounter));
          console.log(`API Requests Made: ${apiCounter.count}`);
        }
      },
      onerror: function (error) {
        console.error('Failed to fetch images for:', query, 'Error:', error);
        // Increment the API counter even for failed requests
        apiCounter.count++;
        localStorage.setItem('apiCounterData', JSON.stringify(apiCounter));
        console.log(`API Requests Made: ${apiCounter.count}`);
      }
    });
  }

  // Function to create the API key input field
  function createApiKeyInput () {
    const apiKeyInput = document.createElement('input');
    apiKeyInput.type = 'password';
    apiKeyInput.placeholder = 'Enter API Key';
    apiKeyInput.style.position = 'fixed';
    apiKeyInput.style.bottom = '10px';
    apiKeyInput.style.right = '10px';
    apiKeyInput.style.width = '120px';
    apiKeyInput.style.padding = '2px';
    apiKeyInput.style.fontSize = '0.9em';
    apiKeyInput.style.border = '1px solid #ccc';
    apiKeyInput.title = 'Enter your Google API key to enable auto image search.';

    if (apiKey) {
      apiKeyInput.value = apiKey;
    }

    apiKeyInput.addEventListener('input', (event) => {
      apiKey = event.target.value.trim();
      console.log('API key set:', apiKey);
      localStorage.setItem('googleApiKey', apiKey);
    });

    const toggleButton = document.createElement('button');
    toggleButton.innerText = 'Show';
    toggleButton.style.position = 'fixed';
    toggleButton.style.bottom = '10px';
    toggleButton.style.right = '140px';
    toggleButton.style.fontSize = '0.8em';
    toggleButton.style.padding = '2px';

    toggleButton.addEventListener('click', () => {
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleButton.innerText = 'Hide';
      } else {
        apiKeyInput.type = 'password';
        toggleButton.innerText = 'Show';
      }
    });

    document.body.appendChild(apiKeyInput);
    document.body.appendChild(toggleButton);
  }

  // Function to display the API counter
  function displayApiCounter () {
    console.log(`API Requests Made Today: ${apiCounter.count}`);
  }

  window.addEventListener('load', () => {
    checkAndResetApiCounter(); // Reset counter if it's a new day
    addButtonsToFoodItems();
    createApiKeyInput();
  });
})();
