"""
Script d'analyse des mots dans les amendements déposés en ??

"""

# Importing modules
import pandas as pd
amdt = pd.read_csv('textes_amendements_nouveaux_articles_plfss_2020-2021.csv')
#amdt = pd.read_csv('https://github.com/leximpact/donnees-extraites-assemblee/raw/main/textes_amendements_nouveaux_articles_plfss_2020-2021.csv')
#print(amdt.head(1))

#Nombre total d'amendements
print("Nombre total d'amendements: ", len(amdt) )

#On regroupe dans un même texte chaque dispositif et son exposés sommaire
amdt['texte'] = amdt['dispositif'] + amdt['exposeSommaire'] 

### Mise en forme des mots
#Tokenisation := découpage des mots 
import nltk
from nltk.tokenize import word_tokenize
tokenized = [ word_tokenize(text) for text in amdt['texte'] ] #return_token

#Normalization
#Stop words
from nltk.corpus import stopwords
stop_words = set( stopwords.words("french"))
#Tokenisation := découpage du texte en listes de mots
from nltk.tokenize import word_tokenize
tokenized = [ word_tokenize(text) for text in amdt['texte'] ] #return_token

# #Removing punctuation AND Casing
#( Casing: Est-ce vraiment utile ? Est-ce qu'on ne va pas perdre les Acronymes de vue ?)
new_tokenized = []
for token in tokenized:
    new_tokenized.append([ word.lower() for word in token if word.isalpha()])
    
    #Stop words

#On importe les mots "inutiles" (stopwords) du langage français
from nltk.corpus import stopwords 
stop_words = stopwords.words("french")

#On importe nos propres stopwords
SW = pd.read_csv('Added_stop_words.csv')
SW = list(SW['StopWords'])

#Stop Word removal
final_SW = SW + stop_words
tokenized = []
for token in new_tokenized:
    tokenized.append([ word for word in token if word not in final_SW])
    
import nltk
nltk.download('wordnet')
#Lemmatization: on reduit les mots à leur racine
from nltk.stem import WordNetLemmatizer
lemmatizer = WordNetLemmatizer()

amdt_clean= []
for token in tokenized:
    amdt_clean.append([lemmatizer.lemmatize(word) for word in token])
#print(amdt_clean[4])

df = pd.DataFrame(amdt_clean)
#print(df.head(10))
df.to_csv('amdt_clean2.csv')  #Chaque ligne est un amendement

#Counting
from collections import Counter

most = []
for token in amdt_clean:
    bow = Counter(token)
    most.append(bow.most_common(30))


df = pd.DataFrame(most)
#print(df.head(10))
df.to_csv('most_common_word_per_amdt2.csv')  #Chaque ligne est un amendement 

#Mise sous forme 'corpus'
corpus = []
for amdt1 in amdt_clean:
    temp = ' '.join(amdt1)
    corpus.append(temp)
    temp = ''
    
#Vectorization - Term Frequency in Global Corpus
from sklearn.feature_extraction.text import CountVectorizer
vectorizer = CountVectorizer()
tf = vectorizer.fit_transform(corpus)

#Génération du corpus index
import re
corpus_index = amdt['texteLegislatifUid'].tolist()

#IDF - Inverse Document Frequencies
from sklearn.feature_extraction.text import TfidfTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
#df_term_frequencies = pd.DataFrame(tf.T.todense(), index = feature_names, columns=corpus_index)
#transformer = TfidfTransformer(norm = None)
#transformer.fit(tf)
#idf = transformer.idf_
#print(idf)


# initialize and fit TfidfVectorizer
vectorizer = TfidfVectorizer(norm=None)
tf_idf_scores = vectorizer.fit_transform(corpus)

# get vocabulary of terms
feature_names = vectorizer.get_feature_names()

# create pandas DataFrame with tf-idf scores
df_tf_idf = pd.DataFrame(tf_idf_scores.T.todense(), index=feature_names, columns=corpus_index)

#Organizing by most common words
#for amendement in df_tf_idf:
    
    #df_tf_idf.sort_values(amendement)