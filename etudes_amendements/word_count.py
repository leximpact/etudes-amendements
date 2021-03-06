# AUTOGENERATED! DO NOT EDIT! File to edit: notebook/02_word_count.ipynb (unless otherwise specified).

__all__ = ['load_data', 'amdt', 'build_word_cloud']

# Cell
import pickle
import pandas as pd
from urllib.request import urlopen
from collections import Counter
from wordcloud import WordCloud

# Cell
amdt = None
def load_data():
    global amdt
    #data_words = pickle.load(urlopen("https://github.com/leximpact/etudes-amendements/raw/nbdev/notebook/data/amdt_data_words.pickle"))
    data_words = pickle.load(open("./data/amdt_data_words.pickle", "rb"))
    #amdt = pd.read_csv('https://github.com/leximpact/etudes-amendements/raw/nbdev/notebook/data/amdt_sans_stopword.csv.gz')
    amdt = pd.read_csv('./data/amdt_sans_stopword.csv.gz')

    word_count = Counter(data_words)
    word_count.most_common(30)

# Cell
def build_word_cloud():
    # Join the different processed titles together.
    long_string = ' '.join(list(amdt['txt_sans_stopword'].values))
    # Create a WordCloud object
    wordcloud = WordCloud(background_color="white", width=1000, height=800, max_words=5000, contour_width=3, contour_color='steelblue')
    # Generate a word cloud
    wordcloud.generate(long_string)
    # Visualize the word cloud
    return wordcloud