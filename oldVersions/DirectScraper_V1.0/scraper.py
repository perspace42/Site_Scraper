'''
Author: Scott Field
Date: 09/01/2025
Purpose:
Using selenium scrape data from a given movie/tv show title
then output that data to the user
'''
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

#Function to print show data
def printShow(show):
    print(f"{index}:\n{'='*50}")
    for key,value in show.items():
        print(f"\t{key}\t:\t{value}")
    print(f"{'='*50}")

#Get Brave Browser Location
options = Options()
options.binary_location = "/usr/bin/brave-browser"

#Use Chrome Driver For Brave Browser
driver = webdriver.Chrome(options=options)
#Get Website
driver.get("https://www.imdb.com/")
driver.implicitly_wait(0.5)

#Get Search Elements From Website
searchText = driver.find_element(
    By.ID,"suggestion-search"
)
searchSubmitBtn = driver.find_element(
    By.ID,"suggestion-search-button"
)

#Submit Search
name = input("Please Enter a Title To Search For\n:")
searchText.send_keys(name)
searchSubmitBtn.click()

#Find Box
resultsBox = driver.find_element(
    By.CSS_SELECTOR, "section[data-testid='find-results-section-title']"
)
#Grab List of Titles From Box
titlesList = resultsBox.find_element(
    By.CSS_SELECTOR,"ul[role='presentation']"
)
#Grab & Order Elements From List Of Titles (only grabbing direct children)
titles = titlesList.find_elements(
    By.XPATH,"./li"
)
#Grab Links from titlesList (each link is within two div tags)
links = titlesList.find_elements(
    By.XPATH, ".//div/div/a"
)

#Grab number of titles
numTitles = len(titles)

#Organize Text From Obtained Data
showList = []
for index in range(0,numTitles,1):
    #Store data obtained from show
    show = {}
    #Add title to show
    currentTitle = titles[index]
    currentLink = links[index]
    responseText = currentLink.text
    #Add other data to show
    ulList = currentTitle.find_elements(By.TAG_NAME,"ul")
    #Adds data from show to dictionary
    for counter in range(0,len(ulList),1):
        ul = ulList[counter]
        liList = ul.find_elements(By.TAG_NAME,"li")
        match counter:
            #if first row
            case 0:
                match len(liList):
                    #still need to handle case where type is not present
                    case 1:
                        show["title"] = responseText
                        show["type"]    = liList[0].text == None ? "future" : liList[0].text
                        counter+=1 #nothing in second row
                    case 2:
                        show["date"]    = liList[0].text
                        show["type"]    = liList[1].text
                    case 3:
                        show["date"]    = liList[0].text
                        show["episode"] = liList[1].text
                        show["epType"]  = liList[2].text
            #if second row
            case 1:
                match len(liList):
                    case 1:
                        show["title"]   = responseText
                        show["actors"]  = liList[0].text
                    case 2:
                        show["epTitle"] = responseText
                        show["title"]   = liList[0].text
                        show["type"]    = liList[1].text

    #add the link to the show
    #show["link"] = None
    #add all shows to the list
    showList.append(show)
    #print show data
    printShow(show)


#User Enters Selected Title Index
selection = int(input("Please Enter The Series Index\n:"))
show = showList[selection]
#Page Then Changes To That Selection
links[selection].click()

#Get Tags From Selected Show (Contained within a tags within the div of class ipc-chip-list__scroller)
tagList = []
tagBox = driver.find_element(By.CSS_SELECTOR,"div[class='ipc-chip-list__scroller']")
tagLinks = tagBox.find_elements(By.XPATH,"./a")
numTags = len(tagLinks)
#Add tags to show
for index in range(0,numTags,1):
    tagText = tagLinks[index].text
    tagList.append(tagText)
show["tags"] = tagList

#Add description to show
parBox = driver.find_element(By.CSS_SELECTOR,"p[data-testid='plot']")
desc = parBox.find_element(By.XPATH,"./span").text
show["description"] = desc

printShow(show)

input("Select Any Key to Exit")
#Close
driver.quit()
