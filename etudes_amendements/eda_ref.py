# AUTOGENERATED! DO NOT EDIT! File to edit: notebook/eda_ref_amendements.ipynb (unless otherwise specified).

__all__ = ['load_data', 'display_distinct']

# Cell
def load_data(file):
    df = pd.read_csv(file)
    df = df.applymap(lambda s:s.lower() if type(s) == str else s)
    return df

# Cell
def display_distinct(df):
    columns = df.columns
    to_be_removed = []
    for column in columns:
        nb_unique_values = eval('df["' + column + '"].nunique()')
        print("Nombres de valeurs distinctes pour", column, ":", nb_unique_values)
        if nb_unique_values > 50:
            to_be_removed.append(column)
    print("\nColumn with too many distinct values :\n", to_be_removed)
    '''
    Display distinct values
    '''
    columns_redux = [item for item in columns if item not in to_be_removed ]
    for column in columns_redux:
        print("\n\nValeurs distinctes pour", column, ':')
        eval('print(df["' + column + '"].value_counts())')