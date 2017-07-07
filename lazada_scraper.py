 #! /usr/bin/env python3.6
from bs4 import BeautifulSoup
import urllib.request
import os
import sys
import random
import re
import json
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.proxy import *

sgdmyr = 3.09
sgURL = 'http://www.lazada.sg'
myURL = 'http://www.lazada.com.my'
catalog = '/catalog/?q='
browser = webdriver.PhantomJS(service_log_path=os.path.devnull)

def getSoup(url):
    browser.get(url)
    soupHTML = BeautifulSoup(browser.page_source, 'html5lib')
    return(soupHTML)

# product is from Node.js
product = sys.argv[1]

def getPrice(product, SG=True):
    if SG:
        soup = getSoup(sgURL + catalog + product)
    else:
        soup = getSoup(myURL + catalog + product)
    
    div = soup.find('div', {'class': 'c-product-card__img-placeholder'})
    url = div.find('a')['href']
    img = div.find('img')['src']
    name = div.find_next('a', {'class': 'c-product-card__name'}).getText().strip()
    
    ori = div.find_next('span', {'class': 'c-product-card__price-final'}).getText().strip()
    ori = round(float(re.sub(r"SGD|RM|$|,", "", ori).strip()), 2)
    
    if SG:
        converted = ori * sgdmyr
    else:
        converted = ori / sgdmyr
    return(name, url, img, ori, round(converted, 2))

s_product, s_url, s_img, s_sgd, s_myr = getPrice(product, SG=True)
m_product, m_url, m_img, m_myr, m_sgd = getPrice(s_product, SG=False)

s_title = "SG: " + s_product
s_subtitle =  "RM " + "%0.2f"%s_myr + " (S$ " + "%0.2f"%s_sgd + ")"

m_title = "MY: " + m_product
m_subtitle = "RM " + "%0.2f"%m_myr + " (S$ " + "%0.2f"%m_sgd + ")"
s_url = sgURL + s_url
m_url = myURL + m_url

msg = {"attachment":{
  "type": "template",
  "payload": {
    "template_type": "list",
    "elements": [
      {
        "title": m_title,
        "image_url": m_img,
        "subtitle": m_subtitle,
        "buttons": [
          {
              "type": "web_url",
              "url": m_url,
              "title": "View in Lazada.my"
          }
        ]
      },
      {
        "title": s_title,
        "image_url": s_img,
        "subtitle": s_subtitle,
        "buttons": [
          {
              "type": "web_url",
              "url": s_url,
              "title": "View in Lazada.sg"
          }
        ]
      }
    ]
  }
}}

''' to test if node reads the JSON properly
msg = { 'attachment': {
            'type': 'template',
            'payload': {
                'template_type': 'generic',
                'elements': [
                    {
                        'title': 'Classic White T-Shirt',
                        'image_url': 'http://petersapparel.parseapp.com/img/item100-thumb.png',
                        'subtitle': 'Soft white cotton t-shirt is back in style',
                        'buttons': [
                            {
                                'type': 'web_url',
                                'url': 'https://petersapparel.parseapp.com/view_item?item_id=100',
                                'title': 'View Item'
                            },
                            {
                                'type': 'web_url',
                                'url': 'https://petersapparel.parseapp.com/buy_item?item_id=100',
                                'title': 'Buy Item'
                            },
                            {
                                'type': 'postback',
                                'title': 'Bookmark Item',
                                'payload': 'White T-Shirt'
                            }
                        ]
                    }
                ]
            }
}}
'''
print(json.dumps(msg))
sys.stdout.flush()

browser.quit()
