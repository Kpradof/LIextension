const baseUrl = 'https://www.linkedin.com/voyager/api/';
const maxPostCount = 100;

// Builds the Header needed to call the API and impersonate the logged in user.
const getApiHeaders = async function() {
    let finalCookie = "";
    let csrfToken = "";

    try {
        const cookies = await chrome.cookies.getAll({ url: 'https://www.linkedin.com/' });
        console.log(cookies);
        for(let cookie of cookies) {
            console.log(cookie.name, cookie.value);
            finalCookie = finalCookie + cookie.name + '=' + cookie.value + ';'
            if (cookie.name == 'JSESSIONID') {
                csrfToken = cookie.value.replace('\"', '').replace('\"', '');
            }
        }
        console.log(finalCookie);
    } catch {
        // ignore
    }

    apiHeaders = {
        'Accept': 'application/json',
        'csrf-token': csrfToken,
        'Cookie': finalCookie
    };

    console.log(apiHeaders);    
    return apiHeaders;
}

// Calls Me endpoint and gets loggedin information
const getMe = async function() {
    const endpointUrl = 'me';
    const response = await fetch(baseUrl + endpointUrl, {
        headers: await getApiHeaders()
    });
    const jsonData = await response.json();
    console.log(jsonData);

    // Initialize CSV file
    let csv = [];
    let name = 'me';
    // Create header
    let row = ['"First Name"', '"Last Name"', '"Entity Urn"', '"Dash Entity Urn"', '"Occupation"', '"Public Identifier"'];
    csv.push(row.join(","));

    // Create rows
    row = [];
    row.push('"' + jsonData.miniProfile.firstName + '"');
    row.push('"' + jsonData.miniProfile.lastName + '"');
    row.push('"' + jsonData.miniProfile.entityUrn + '"');
    row.push('"' + jsonData.miniProfile.dashEntityUrn + '"');
    row.push('"' + jsonData.miniProfile.occupation + '"');
    name = jsonData.miniProfile.publicIdentifier;
    row.push('"' + name + '"');
    csv.push(row.join(","));

    let fileName = 'LinkedIn_' + name + '_profile.csv';
    createCSV(csv, fileName);
}

async function getProfilePosts(profileName, count) {
    let endpointUrl = 'identity/profiles/' + profileName;
    let response = await fetch(baseUrl + endpointUrl, {
        headers: await getApiHeaders()
    });
    let jsonData = await response.json();
    console.log(jsonData);
    
    let dashEntityUrn = encodeURIComponent(jsonData.miniProfile.dashEntityUrn);

    elements = await fetchProfilePosts(count, dashEntityUrn, 0, 'memberShareFeed', 'member-shares%3Aphone', true, '');
    if (elements.length > count) {
        elements = elements.slice(0,count);
    }
    

    /*endpointUrl = 'identity/profileUpdatesV2?count=' + count + '&includeLongTermHistory=true&moduleKey=member-shares%3Aphone&profileUrn=' + dashEntityUrn + '&q=memberShareFeed&start=0';
    response = await fetch(baseUrl + endpointUrl, {
        headers: await getApiHeaders()
    });
    jsonData = await response.json();
    console.log(jsonData);*/

    // Initialize CSV file
    let csv = [];
    
    // Create header
    let row = ['"DateTime"', '"PostURL"', '"PostCopy"', '"PostType"', '"Likes"', '"Comments"', "'Reposts'", '"TotalEngagements"', '"VideoViews"'];
    csv.push(row.join(","));

    for(const x of elements) {
        let row = [];
        let actions = x.updateMetadata.updateActions.actions;
        let url = '';
        
        for(const action of actions) {
            if(action.actionType == 'SHARE_VIA') {
                url = action.url;
                break;
            }
        }

        let text = '';
        if (x.hasOwnProperty('commentary')) {
            text = x.commentary.text.text.replace(/"/g, '""');
        }

        let socialActivity = x.socialDetail.totalSocialActivityCounts;
        let likes = socialActivity.numLikes;
        let comments = socialActivity.numComments;
        let numReposts = 0;
        if (socialActivity.hasOwnProperty('numShares')) {
            numReposts = socialActivity.numShares;
        }
        let numViews = 0
        if (socialActivity.hasOwnProperty('numViews')) {
            numViews = socialActivity.numViews;
        }
        let postType = 'Post';
        if (x.hasOwnProperty('resharedUpdate')) {
            postType = 'Repost';
        }
        let dateTimePost = getLinkedInDate(url);
        let totalEngagements = likes + comments + numReposts;
        
        row.push(dateTimePost);
        row.push('"' + url + '"');
        row.push('"' + text + '"');
        row.push('"' + postType + '"');
        row.push(likes);
        row.push(comments);
        row.push(numReposts);
        row.push(totalEngagements);
        row.push(numViews);
        csv.push(row.join(","));
    }

    let fileName = 'ProfileLinkedIn_' + profileName + '_Posts.csv';
    createCSV(csv, fileName);
}

async function fetchProfilePosts(count, profileUrn, start, q, moduleKey, includeLongTermHistory) {
    oldEndpointUrl = 'identity/profileUpdatesV2?count=' + count + '&includeLongTermHistory=true&moduleKey=member-shares%3Aphone&profileUrn=' + profileUrn + '&q=memberShareFeed&start=0';
    let postCount = Math.min(count, maxPostCount);
    endpointUrl = createProfileEndpoint(postCount, profileUrn, start, q, moduleKey, includeLongTermHistory, '');

    response = await fetch(baseUrl + endpointUrl, {
        headers: await getApiHeaders()
    });
    jsonData = await response.json();
    console.log(jsonData);

    if (response.status != 200) {
        console.log('Error: ' + response);
        return [];
    }

    while (jsonData.metadata.paginationToken != '') {
        if (jsonData.elements.length >= count) {
            break;
        }

        start = start + maxPostCount;        
        endpointUrl = createProfileEndpoint(postCount, profileUrn, start, q, moduleKey, includeLongTermHistory, jsonData.metadata.paginationToken);
        response = await fetch(baseUrl + endpointUrl, {
            headers: await getApiHeaders()
        });
        newJsonData = await response.json();
        console.log(newJsonData);

        jsonData.metadata = newJsonData.metadata;
        jsonData.elements = jsonData.elements.concat(newJsonData.elements);
        jsonData.paging = newJsonData.paging;
    }

    return jsonData.elements;
}

function createProfileEndpoint(count, profileUrn, start, q, moduleKey, includeLongTermHistory, paginationToken) {
    endpointUrl = 'identity/profileUpdatesV2?count=' + count;
    endpointUrl = endpointUrl + '&includeLongTermHistory=' + includeLongTermHistory;
    endpointUrl = endpointUrl + '&moduleKey=' + moduleKey;
    endpointUrl = endpointUrl + '&profileUrn=' + profileUrn;
    endpointUrl = endpointUrl + '&q=' + q;
    endpointUrl = endpointUrl + '&start=' + start;
    if (paginationToken != '') {
        endpointUrl = endpointUrl + '&paginationToken=' + paginationToken;
    }

    return endpointUrl;
}

async function getCompanyPosts(companyName, count) {
    companyName = encodeURIComponent(companyName);

    let elements = await fetchCompanyPosts(companyName, count, []);
    if (elements.length > count) {
        elements = elements.slice(0,count);
    }

    // Initialize CSV file
    let csv = [];
    
    // Create header
    let row = ['"DateTime"', '"PostURL"', '"PostCopy"', '"PostType"', '"Likes"', '"Comments"', "'Reposts'", '"TotalEngagements"', '"VideoViews"'];
    csv.push(row.join(","));

    for(const x of elements) {
        let row = [];
        let updateV2 = x.value["com.linkedin.voyager.feed.render.UpdateV2"];
        
        let url = updateV2.updateMetadata.updateActions.actions[1].url;

        let text = '';
        if (updateV2.hasOwnProperty('commentary')) {
            text = updateV2.commentary.text.text.replace(/"/g, '""');
        }

        let socialActivity = updateV2.socialDetail.totalSocialActivityCounts;
        let likes = socialActivity.numLikes;
        let comments = socialActivity.numComments;
        let numReposts = 0;
        if (socialActivity.hasOwnProperty('numShares')) {
            numReposts = socialActivity.numShares;
        }
        let numViews = 0
        if (socialActivity.hasOwnProperty('numViews')) {
            numViews = socialActivity.numViews;
        }
        let postType = 'Post';
        if (x.hasOwnProperty('header')) {
            postType = 'Repost';
        }
        let dateTimePost = getLinkedInDate(url);
        let totalEngagements = likes + comments + numReposts;
        
        row.push(dateTimePost);
        row.push('"' + url + '"');
        row.push('"' + text + '"');
        row.push('"' + postType + '"');
        row.push(likes);
        row.push(comments);
        row.push(numReposts);
        row.push(totalEngagements);
        row.push(numViews);
        csv.push(row.join(","));
    }

    let fileName = 'CompanyLinkedIn_' + companyName + '_Posts.csv';
    createCSV(csv, fileName);
}

async function fetchCompanyPosts(companyName, count, results) {
    if (results == null) {
        results = [];
    }

    let endpointUrl = 'feed/updates?companyUniversalName=' + companyName + '&q=companyFeedByUniversalName&moduleKey=member-share&count=' + maxPostCount + '&start=' + results.length;
    let response = await fetch(baseUrl + endpointUrl, {
        headers: await getApiHeaders()
    });
    let jsonData = await response.json();
    console.log(jsonData);

    if (response.status != 200) {
        console.log('Error: ' + response);
        return [];
    }

    if (jsonData.elements.length == 0 ||
            results.length >= count ||
            results.length / count >= 200) {
        return results;
    }

    results = results.concat(jsonData.elements);

    return await fetchCompanyPosts(companyName, count, results);
}

function createProfileEndpoint(count, profileUrn, start, q, moduleKey, includeLongTermHistory, paginationToken) {
    endpointUrl = 'identity/profileUpdatesV2?count=' + count;
    endpointUrl = endpointUrl + '&includeLongTermHistory=' + includeLongTermHistory;
    endpointUrl = endpointUrl + '&moduleKey=' + moduleKey;
    endpointUrl = endpointUrl + '&profileUrn=' + profileUrn;
    endpointUrl = endpointUrl + '&q=' + q;
    endpointUrl = endpointUrl + '&start=' + start;
    if (paginationToken != '') {
        endpointUrl = endpointUrl + '&paginationToken=' + paginationToken;
    }

    return endpointUrl;
}

function getLinkedInDate(linkedinURL) {
    const postId = getPostId(linkedinURL);
    const unixTimestamp = extractUnixTimestamp(postId);
    const humanDateFormat = unixTimestampToHumanDate(unixTimestamp);
    return humanDateFormat;
}

function getPostId(linkedinURL) {
    const regex = /([0-9]{19})/;
    const postId = regex.exec(linkedinURL).pop();
    return postId;
}

function extractUnixTimestamp(postId) {
    // BigInt needed as we need to treat postId as 64 bit decimal. This reduces browser support.
    const asBinary = BigInt(postId).toString(2);
    const first41Chars = asBinary.slice(0, 41);
    const timestamp = parseInt(first41Chars, 2);
    return timestamp;
}

function unixTimestampToHumanDate(timestamp) {
    const dateObject = new Date(timestamp);
    //const humanDateFormat = dateObject.toUTCString()+" (UTC)";
    //dateTimePost = datetime.utcfromtimestamp(pythonTimestamp).strftime('%Y-%m-%d %H:%M:%S')
    humanDateFormat = dateObject.toISOString().replace('T', ' ').split('.')[0];
    return humanDateFormat;
}

function createCSV(csv, fileName) {
    let downloadLink = document.createElement('a');
    downloadLink.download = fileName;
    chrome.storage.local.get(["encoding"], (result)=> {
        let dataBlob = (result["encoding"] == "utf") ? new Blob([csv.join("\r\n")], {type: "text/csv"}) : new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv.join("\r\n")], {type: "text/csv;charset=utf-8"});
        downloadLink.href = window.URL.createObjectURL(dataBlob);
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
        var loadingContainer = document.querySelector('#loading-container');
        loadingContainer.style.display = "none";
        downloadLink.click();	
    });
}

/*const cta_button_company = document.querySelector("#cta_button_company");
cta_button_company.addEventListener("click", (event) => {
    let items_search_company = document.querySelector("#items_search_company").value;
    let company_search = document.querySelector("#company_search").value;
    getCompanyPosts(company_search, items_search_company);
});*/

/*const cta_button_person = document.querySelector("#cta_button_person");
cta_button_person.addEventListener("click", (event) => {
    let items_search_person = document.querySelector("#items_search_person").value;
    let person_search = document.querySelector("#person_search").value;
    getProfilePosts(person_search, items_search_person);
});*/

document.addEventListener('DOMContentLoaded', (event) => {
    // Button element
    var cta_button_company = document.querySelector('#cta_button_company');

    // Check if the button is present
    if (cta_button_company) {
        // Adding the click event listener to the button
        cta_button_company.addEventListener('click', function() {
            // Get the loading container element
            var loadingContainer = document.querySelector('#loading-container');
            // Check if the loading container is present
            if (loadingContainer) {
                // Make the loading container visible
                loadingContainer.style.display = 'flex';
                let items_search_company = document.querySelector("#items_search_company").value;
                let company_search = document.querySelector("#company_search").value;
                getCompanyPosts(company_search, items_search_company);
            } else {
                console.error('Loading container not found!');
            }
        });
    } else {
        console.error('Button not found!');
    }
    
    const cta_button_person = document.querySelector("#cta_button_person");
    if (cta_button_person) {
        // Adding the click event listener to the button
        cta_button_person.addEventListener('click', function() {
            // Get the loading container element
            var loadingContainer = document.querySelector('#loading-container');
            // Check if the loading container is present
            if (loadingContainer) {
                // Make the loading container visible
                loadingContainer.style.display = 'flex';
                let items_search_person = document.querySelector("#items_search_person").value;
                let person_search = document.querySelector("#person_search").value;
                getProfilePosts(person_search, items_search_person);
            } else {
                console.error('Loading container not found!');
            }
        });
    } else {
        console.error('Button not found!');
    }
});

/*
function getMe() {
    const endpointUrl = 'me';
    fetch(baseUrl + endpointUrl, {
        headers: {
            'Accept': 'application/json',
            'csrf-token': 'ajax:4413984923165580933',
            'Cookie': 'bcookie="v=2&57e4e3df-3af8-4049-8125-7c438b34bce3"; lidc="b=OB42:s=O:r=O:a=O:p=O:g=3954:u=11:x=1:i=1684158182:t=1684243213:v=2:sig=AQH4-HxadnN2-Et2C6n-wyj7_usilLoB"; JSESSIONID="ajax:4413984923165580933"; bscookie="v=1&20211111233430b43680ff-512e-43ca-80b2-000499082eacAQEZwWO-Vj6mdCVoY0YDn63XWOMiaDRQ"; li_at=AQEDAUILWvoFzN5GAAABh-cWT5oAAAGIPr1BWlYAxCQhY0BMMc850BEGYtTsAqPmE4Jwc2nqJVN5-vGlehBdFfQkZshTuYRGADNJFW5mIIXWhMYpApCHE2Agh68_9y3HOmflUXbk5jZ6xF5n6mhFybVG; li_rm=AQGNnvw3yRhM-gAAAYfnFfznwAp2WR6dyfoRLnagDRoMLmK5NQeiUb_X24oiOFxhY7s1B7FegrXfx1k6KhBaj-8SPvT9MD7SYdCiNQMs3srpCPhd5o-lT9kM; li_theme=light; li_theme_set=app'
        }
    })
   .then(response => response.text())
   .then(text => console.log(text))
}
*/